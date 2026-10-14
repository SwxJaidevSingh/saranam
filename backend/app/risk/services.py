"""Risk assessment services for calculating risk scores from form submissions."""
from datetime import datetime
from app.extensions import db
from app.risk.models import FieldRiskRule, FormRiskLevel, SubmissionRiskScore
from app.submissions.models import FormSubmission, FormAnswer


class RiskAssessmentService:
    """Service for calculating and managing risk scores."""

    @staticmethod
    def calculate_risk_score(submission_id):
        """
        Calculate risk score for a form submission.

        Args:
            submission_id: UUID of the FormSubmission

        Returns:
            dict: {
                'total_score': float,
                'risk_level': str,
                'field_scores': dict
            }
        """
        submission = FormSubmission.query.get(submission_id)
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")

        # Get risk rules for this form
        risk_rules = FieldRiskRule.query.filter_by(form_id=submission.form_id).all()

        if not risk_rules:
            # No risk rules defined, return default
            return {
                'total_score': 0,
                'risk_level': 'Not Assessed',
                'field_scores': {}
            }

        # Get all answers for this submission
        answers = FormAnswer.query.filter_by(submission_id=submission_id).all()
        answers_dict = {answer.field_id: answer for answer in answers}

        # Calculate score for each field
        field_scores = {}
        total_score = 0

        for rule in risk_rules:
            if rule.field_id in answers_dict:
                answer = answers_dict[rule.field_id]
                field_value = answer.get_value()

                # Calculate score for this field
                score = rule.calculate_score(field_value)

                if score > 0:
                    field_scores[rule.field_id] = {
                        'field_label': answer.field_label,
                        'field_value': field_value,
                        'score': float(score),
                        'rule_type': rule.rule_type
                    }
                    total_score += score

        # Determine risk level based on thresholds
        risk_level = RiskAssessmentService._determine_risk_level(
            submission.form_id,
            total_score
        )

        return {
            'total_score': float(total_score),
            'risk_level': risk_level,
            'field_scores': field_scores
        }

    @staticmethod
    def _determine_risk_level(form_id, total_score):
        """
        Determine risk level based on score and form risk thresholds.

        Args:
            form_id: UUID of the form
            total_score: Calculated total risk score

        Returns:
            str: Risk level name
        """
        risk_levels = FormRiskLevel.query.filter_by(form_id=form_id).order_by(
            FormRiskLevel.min_score.asc()
        ).all()

        if not risk_levels:
            # No risk levels defined, use default categories
            if total_score == 0:
                return 'Not Assessed'
            elif total_score <= 3:
                return 'Low'
            elif total_score <= 6:
                return 'Moderate'
            elif total_score <= 9:
                return 'High'
            else:
                return 'Critical'

        # Find matching risk level
        for level in risk_levels:
            if level.matches_score(total_score):
                return level.level_name

        # If no match, return highest level if score exceeds all thresholds
        if risk_levels and total_score > risk_levels[-1].max_score:
            return risk_levels[-1].level_name

        return 'Unknown'

    @staticmethod
    def save_risk_score(submission_id, total_score, risk_level, field_scores):
        """
        Save or update risk score for a submission.

        Args:
            submission_id: UUID of the submission
            total_score: Calculated total score
            risk_level: Determined risk level
            field_scores: Breakdown of scores by field

        Returns:
            SubmissionRiskScore: Saved risk score record
        """
        existing_score = SubmissionRiskScore.query.get(submission_id)

        if existing_score:
            # Update existing
            existing_score.total_score = total_score
            existing_score.risk_level = risk_level
            existing_score.field_scores = field_scores
            existing_score.calculated_at = datetime.utcnow()
            existing_score.updated_at = datetime.utcnow()
        else:
            # Create new
            existing_score = SubmissionRiskScore(
                submission_id=submission_id,
                total_score=total_score,
                risk_level=risk_level,
                field_scores=field_scores,
                calculated_at=datetime.utcnow()
            )
            db.session.add(existing_score)

        db.session.commit()
        return existing_score

    @staticmethod
    def calculate_and_save(submission_id):
        """
        Calculate risk score and save it in one operation.

        Args:
            submission_id: UUID of the submission

        Returns:
            dict: Risk score details
        """
        result = RiskAssessmentService.calculate_risk_score(submission_id)

        RiskAssessmentService.save_risk_score(
            submission_id,
            result['total_score'],
            result['risk_level'],
            result['field_scores']
        )

        return result

    @staticmethod
    def get_risk_score(submission_id):
        """
        Get cached risk score for a submission.

        Args:
            submission_id: UUID of the submission

        Returns:
            SubmissionRiskScore or None
        """
        return SubmissionRiskScore.query.get(submission_id)

    @staticmethod
    def recalculate_all_for_form(form_id):
        """
        Recalculate risk scores for all submissions of a form.
        Useful when risk rules are updated.

        Args:
            form_id: UUID of the form

        Returns:
            dict: Summary of recalculation
        """
        submissions = FormSubmission.query.filter_by(form_id=form_id).all()

        updated_count = 0
        errors = []

        for submission in submissions:
            try:
                RiskAssessmentService.calculate_and_save(submission.id)
                updated_count += 1
            except Exception as e:
                errors.append({
                    'submission_id': str(submission.id),
                    'error': str(e)
                })

        return {
            'total_submissions': len(submissions),
            'updated': updated_count,
            'errors': errors
        }

    @staticmethod
    def get_high_risk_submissions(form_id=None, risk_level='High'):
        """
        Get submissions with high risk scores.

        Args:
            form_id: Optional form ID to filter by
            risk_level: Risk level to filter by (default 'High')

        Returns:
            list: High-risk submissions
        """
        query = db.session.query(FormSubmission, SubmissionRiskScore).join(
            SubmissionRiskScore,
            FormSubmission.id == SubmissionRiskScore.submission_id
        ).filter(
            SubmissionRiskScore.risk_level == risk_level
        )

        if form_id:
            query = query.filter(FormSubmission.form_id == form_id)

        results = query.all()

        return [
            {
                'submission': submission.to_dict(),
                'risk_score': risk_score.to_dict()
            }
            for submission, risk_score in results
        ]

    @staticmethod
    def get_risk_distribution(form_id):
        """
        Get distribution of risk levels for a form.

        Args:
            form_id: UUID of the form

        Returns:
            dict: Count by risk level
        """
        results = db.session.query(
            SubmissionRiskScore.risk_level,
            db.func.count(SubmissionRiskScore.submission_id)
        ).join(
            FormSubmission,
            FormSubmission.id == SubmissionRiskScore.submission_id
        ).filter(
            FormSubmission.form_id == form_id
        ).group_by(
            SubmissionRiskScore.risk_level
        ).all()

        distribution = {level: count for level, count in results}

        # Include risk levels with 0 count
        all_levels = FormRiskLevel.query.filter_by(form_id=form_id).all()
        for level in all_levels:
            if level.level_name not in distribution:
                distribution[level.level_name] = 0

        return distribution


class RiskRuleService:
    """Service for managing risk rules."""

    @staticmethod
    def create_risk_rule(form_id, field_id, rule_type, condition, created_by=None):
        """
        Create a new risk rule for a form field.

        Args:
            form_id: UUID of the form
            field_id: ID of the field in form schema
            rule_type: 'range' or 'categorical'
            condition: Risk rule configuration (dict)
            created_by: UUID of user creating the rule

        Returns:
            FieldRiskRule: Created risk rule
        """
        rule = FieldRiskRule(
            form_id=form_id,
            field_id=field_id,
            rule_type=rule_type,
            condition=condition,
            created_by=created_by
        )

        # Validate condition
        is_valid, message = rule.validate_condition()
        if not is_valid:
            raise ValueError(f"Invalid condition: {message}")

        db.session.add(rule)
        db.session.commit()

        return rule

    @staticmethod
    def update_risk_rule(rule_id, condition):
        """
        Update risk rule condition.

        Args:
            rule_id: UUID of the rule
            condition: New condition configuration

        Returns:
            FieldRiskRule: Updated rule
        """
        rule = FieldRiskRule.query.get(rule_id)
        if not rule:
            raise ValueError(f"Risk rule {rule_id} not found")

        rule.condition = condition
        rule.updated_at = datetime.utcnow()

        # Validate new condition
        is_valid, message = rule.validate_condition()
        if not is_valid:
            raise ValueError(f"Invalid condition: {message}")

        db.session.commit()

        # Recalculate risk scores for all submissions of this form
        RiskAssessmentService.recalculate_all_for_form(rule.form_id)

        return rule

    @staticmethod
    def delete_risk_rule(rule_id):
        """Delete a risk rule."""
        rule = FieldRiskRule.query.get(rule_id)
        if not rule:
            raise ValueError(f"Risk rule {rule_id} not found")

        form_id = rule.form_id
        db.session.delete(rule)
        db.session.commit()

        # Recalculate risk scores for all submissions
        RiskAssessmentService.recalculate_all_for_form(form_id)

    @staticmethod
    def get_form_risk_rules(form_id):
        """Get all risk rules for a form."""
        return FieldRiskRule.query.filter_by(form_id=form_id).all()


class RiskLevelService:
    """Service for managing risk level thresholds."""

    @staticmethod
    def set_risk_levels(form_id, levels, created_by=None):
        """
        Set risk levels for a form (replaces existing).

        Args:
            form_id: UUID of the form
            levels: List of level definitions [
                {'level_name': 'Low', 'min_score': 0, 'max_score': 3, 'color_code': '#22c55e', ...},
                ...
            ]
            created_by: UUID of user

        Returns:
            list: Created FormRiskLevel objects
        """
        # Delete existing levels
        FormRiskLevel.query.filter_by(form_id=form_id).delete()

        # Create new levels
        created_levels = []
        for level_data in levels:
            level = FormRiskLevel(
                form_id=form_id,
                level_name=level_data['level_name'],
                min_score=level_data['min_score'],
                max_score=level_data['max_score'],
                color_code=level_data.get('color_code'),
                description=level_data.get('description'),
                created_by=created_by
            )

            # Validate scores
            is_valid, message = level.validate_scores()
            if not is_valid:
                raise ValueError(f"Invalid level '{level.level_name}': {message}")

            db.session.add(level)
            created_levels.append(level)

        db.session.commit()

        # Recalculate risk levels for all submissions
        RiskAssessmentService.recalculate_all_for_form(form_id)

        return created_levels

    @staticmethod
    def get_risk_levels(form_id):
        """Get risk levels for a form, ordered by min_score."""
        return FormRiskLevel.query.filter_by(form_id=form_id).order_by(
            FormRiskLevel.min_score.asc()
        ).all()
