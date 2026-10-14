import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  isLoading = false,
  className,
  iconColor = 'text-primary-600',
  iconBgColor = 'bg-primary-100'
}) {
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-24" />
          </CardTitle>
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const isPositiveTrend = trend > 0;
  const isNegativeTrend = trend < 0;

  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-lg", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className={cn("p-2 rounded-full", iconBgColor)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {trend !== undefined && trendLabel && (
          <div className="flex items-center gap-1 mt-2">
            {isPositiveTrend && (
              <Badge variant="outline" className="border-success-300 bg-success-50 text-success-700">
                <TrendingUp className="h-3 w-3 mr-1" />
                {Math.abs(trend)}%
              </Badge>
            )}
            {isNegativeTrend && (
              <Badge variant="outline" className="border-danger-300 bg-danger-50 text-danger-700">
                <TrendingDown className="h-3 w-3 mr-1" />
                {Math.abs(trend)}%
              </Badge>
            )}
            {!isPositiveTrend && !isNegativeTrend && (
              <Badge variant="outline">
                No change
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-1">{trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
