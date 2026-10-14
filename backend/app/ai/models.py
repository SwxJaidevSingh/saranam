"""AI form builder database models."""
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel


class AIFormSession(BaseModel):
    """Track AI form building sessions."""
    __tablename__ = 'ai_form_sessions'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    llm_provider = Column(String(50), nullable=False)  # 'openai', 'anthropic', 'gemini'
    llm_model = Column(String(100), nullable=False)    # 'gpt-4-turbo', 'claude-3.5-sonnet'
    mode = Column(String(20), nullable=False)          # 'general' or 'healthcare'

    # Conversation tracking
    conversation_history = Column(JSONB, nullable=False, default=[])
    current_schema = Column(JSONB, nullable=True)      # Latest form schema

    # Linking
    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id'), nullable=True)

    # Status
    status = Column(String(20), nullable=False, default='active')  # 'active', 'completed', 'abandoned'
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship('User', foreign_keys=[user_id])
    form = relationship('Form', foreign_keys=[form_id])
    generation_logs = relationship('AIGenerationLog', back_populates='session', cascade='all, delete-orphan')

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'llm_provider': self.llm_provider,
            'llm_model': self.llm_model,
            'mode': self.mode,
            'conversation_history': self.conversation_history,
            'current_schema': self.current_schema,
            'form_id': str(self.form_id) if self.form_id else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


class AIGenerationLog(BaseModel):
    """Log all AI interactions for debugging and analytics."""
    __tablename__ = 'ai_generation_logs'

    session_id = Column(UUID(as_uuid=True), ForeignKey('ai_form_sessions.id', ondelete='CASCADE'),
                       nullable=False, index=True)
    prompt_sent = Column(Text, nullable=False)
    response_received = Column(Text, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    session = relationship('AIFormSession', back_populates='generation_logs')

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': str(self.id),
            'session_id': str(self.session_id),
            'prompt_sent': self.prompt_sent[:500] + '...' if len(self.prompt_sent) > 500 else self.prompt_sent,
            'tokens_used': self.tokens_used,
            'latency_ms': self.latency_ms,
            'success': self.success,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
