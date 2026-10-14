import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function CallLogCard({
  title,
  description,
  children,
  isLoading = false,
  className,
  headerAction,
  footer
}) {
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden rounded-[2rem]", className)}>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-40" />
          </CardTitle>
          {description && (
            <CardDescription>
              <Skeleton className="h-4 w-56 mt-2" />
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden rounded-[2rem] border-white/5 bg-white/50 backdrop-blur-sm", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black tracking-tight">{title}</CardTitle>
            {description && (
              <CardDescription className="font-medium">{description}</CardDescription>
            )}
          </div>
          {headerAction && (
            <div className="flex-shrink-0">
              {headerAction}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="border-t border-border/50 pt-6">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
