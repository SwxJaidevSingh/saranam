import { Users, Calendar, TrendingUp, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

export function CohortCard({ cohort, onView, onEdit, onDelete, onRecalculate }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={() => onView(cohort.id)}>
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {cohort.name}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {cohort.description || 'No description'}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(cohort.id)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(cohort.id)}>
                Edit Cohort
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRecalculate(cohort.id)}>
                Recalculate Members
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(cohort.id)}
                className="text-danger-600"
              >
                Delete Cohort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent onClick={() => onView(cohort.id)}>
        <div className="grid grid-cols-2 gap-4">
          {/* Member Count */}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-100">
              <Users className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{cohort.member_count || 0}</p>
              <p className="text-xs text-muted-foreground">Patients</p>
            </div>
          </div>

          {/* Last Updated */}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success-100">
              <Calendar className="h-4 w-4 text-success-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatDate(cohort.last_calculated_at)}</p>
              <p className="text-xs text-muted-foreground">Last updated</p>
            </div>
          </div>
        </div>

        {/* Auto-update Badge */}
        <div className="mt-4 flex items-center gap-2">
          {cohort.auto_update && (
            <Badge variant="outline" className="text-xs border-success-300 bg-success-50 text-success-700">
              <TrendingUp className="h-3 w-3 mr-1" />
              Auto-updating {cohort.update_frequency}
            </Badge>
          )}
          {!cohort.is_active && (
            <Badge variant="outline" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
