import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Building2,
  Stethoscope,
  HeartHandshake,
  Home,
  Check
} from 'lucide-react';

const ServiceTypeCard = ({ type, title, description, features, isSelected, onClick }) => {
  const getIcon = () => {
    switch (type) {
      case 'IPD':
        return <Building2 className="h-8 w-8" />;
      case 'OPD':
        return <Stethoscope className="h-8 w-8" />;
      case 'PHYSIOTHERAPY':
        return <HeartHandshake className="h-8 w-8" />;
      case 'HOME_CARE':
        return <Home className="h-8 w-8" />;
      default:
        return <Stethoscope className="h-8 w-8" />;
    }
  };

  const getColorClass = () => {
    switch (type) {
      case 'IPD':
        return 'text-secondary-600 dark:text-secondary-400 bg-secondary-100 dark:bg-secondary-900';
      case 'OPD':
        return 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900';
      case 'PHYSIOTHERAPY':
        return 'text-success-600 dark:text-success-400 bg-success-100 dark:bg-success-900';
      case 'HOME_CARE':
        return 'text-warning-600 dark:text-warning-400 bg-warning-100 dark:bg-warning-900';
      default:
        return 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'IPD':
        return 'border-secondary-600 dark:border-secondary-400';
      case 'OPD':
        return 'border-primary-600 dark:border-primary-400';
      case 'PHYSIOTHERAPY':
        return 'border-success-600 dark:border-success-400';
      case 'HOME_CARE':
        return 'border-warning-600 dark:border-warning-400';
      default:
        return 'border-primary-600 dark:border-primary-400';
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg relative',
        isSelected && `ring-2 ${getBorderColor()} bg-accent`
      )}
      onClick={onClick}
    >
      {isSelected && (
        <div className={cn(
          'absolute top-3 right-3 rounded-full p-1',
          getColorClass()
        )}>
          <Check className="h-4 w-4" />
        </div>
      )}

      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className={cn(
            'rounded-full p-4 mb-4',
            getColorClass()
          )}>
            {getIcon()}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground mb-4 text-sm">
            {description}
          </p>

          {/* Features */}
          {features && features.length > 0 && (
            <ul className="text-left w-full space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-4 w-4 text-success-500 dark:text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceTypeCard;