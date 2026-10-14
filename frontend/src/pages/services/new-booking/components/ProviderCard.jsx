import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  User,
  Calendar,
  Clock,
  MapPin,
  Award,
  Star,
  Check
} from 'lucide-react';

const ProviderCard = ({ provider, isSelected, onClick }) => {
  const {
    id,
    full_name,
    specialization,
    qualification,
    years_of_experience,
    department,
    consultation_fee,
    available_days,
    available_time_start,
    available_time_end,
    languages,
    rating,
    total_reviews
  } = provider;

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getDaysDisplay = (days) => {
    if (!days || days.length === 0) return 'Not Available';
    if (days.length === 7) return 'All Days';
    if (days.length === 5 && !days.includes('Saturday') && !days.includes('Sunday')) {
      return 'Mon-Fri';
    }
    return days.join(', ');
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg relative overflow-hidden',
        isSelected && 'ring-2 ring-primary-600 dark:ring-primary-400 bg-primary-50 dark:bg-primary-950'
      )}
      onClick={onClick}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 bg-primary-600 dark:bg-primary-500 text-white rounded-full p-1">
          <Check className="h-4 w-4" />
        </div>
      )}

      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>

          {/* Provider Info */}
          <div className="flex-1">
            {/* Name and Qualification */}
            <h3 className="text-lg font-semibold text-foreground">
              {full_name}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              {qualification}
            </p>

            {/* Specialization and Department */}
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="secondary">
                {specialization}
              </Badge>
              {department && (
                <Badge variant="outline">
                  {department}
                </Badge>
              )}
            </div>

            {/* Experience and Rating */}
            <div className="flex items-center space-x-4 mb-3">
              {years_of_experience && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Award className="h-4 w-4 mr-1" />
                  <span>{years_of_experience} years exp.</span>
                </div>
              )}

              {rating && (
                <div className="flex items-center text-sm">
                  <Star className="h-4 w-4 text-warning-500 dark:text-warning-400 fill-current mr-1" />
                  <span className="font-medium">{rating.toFixed(1)}</span>
                  {total_reviews && (
                    <span className="text-muted-foreground ml-1">
                      ({total_reviews})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Availability */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                <span>{getDaysDisplay(available_days)}</span>
              </div>

              {available_time_start && available_time_end && (
                <div className="flex items-center text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>
                    {formatTime(available_time_start)} - {formatTime(available_time_end)}
                  </span>
                </div>
              )}
            </div>

            {/* Languages */}
            {languages && languages.length > 0 && (
              <div className="mt-3 flex items-center text-sm text-muted-foreground">
                <span className="mr-2">Languages:</span>
                <span>{languages.join(', ')}</span>
              </div>
            )}

            {/* Consultation Fee */}
            {consultation_fee && (
              <div className="mt-3 text-lg font-semibold text-primary-600 dark:text-primary-400">
                ₹{consultation_fee}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  consultation fee
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProviderCard;