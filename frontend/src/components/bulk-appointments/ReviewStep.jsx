/**
 * Review Step - Review categorized appointments and resolve conflicts
 */
import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import pureLogicBulkApi from '../../api/pureLogicBulk';

const ReviewStep = ({ sessionData, statistics, onNext, onBack, onError }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('approved');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await pureLogicBulkApi.listItems(sessionData.id, {
        per_page: 1000
      });
      setItems(response.items || []);
    } catch (error) {
      onError('Failed to load items: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const categorizeItems = () => {
    return {
      approved: items.filter(
        (item) => item.status === 'valid' && !item.has_conflict
      ),
      conflicts: items.filter(
        (item) => item.status === 'valid' && item.has_conflict
      ),
      missingProviders: items.filter(
        (item) => item.status === 'missing_provider'
      ),
      rejected: items.filter((item) => item.status === 'invalid')
    };
  };

  const categorized = categorizeItems();

  const handleContinue = async () => {
    // If there are missing providers, let the user resolve them in next step
    if (statistics && statistics.missing_provider_count > 0) {
      try {
        const response = await pureLogicBulkApi.getMissingProviders(sessionData.id);
        onNext({
          missingProviders: response.missing_providers || []
        });
      } catch (error) {
        onError('Failed to get missing providers: ' + error.message);
      }
    } else {
      // No missing providers, skip to confirm step
      onNext({});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="approved" className="relative">
            Auto-Approved
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
              {categorized.approved.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="relative">
            Conflicts
            <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-700">
              {categorized.conflicts.length}
            </Badge>
          </TabsTrigger>
          {statistics && statistics.missing_provider_count > 0 && (
            <TabsTrigger value="missingProviders" className="relative">
              Missing Providers
              <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
                {categorized.missingProviders.length}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="rejected" className="relative">
            Rejected
            <Badge variant="secondary" className="ml-2 bg-red-100 text-red-700">
              {categorized.rejected.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="space-y-4">
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {categorized.approved.map((item) => (
              <Card key={item.id} className="p-4 border-green-200 bg-green-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium">
                        {item.extracted_data?.patient_name}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.extracted_data?.provider_name} •{' '}
                      {item.extracted_data?.appointment_date} at{' '}
                      {item.extracted_data?.appointment_time}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {categorized.conflicts.map((item) => (
              <Card key={item.id} className="p-4 border-yellow-200 bg-yellow-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">
                        {item.extracted_data?.patient_name}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {item.extracted_data?.provider_name} •{' '}
                      {item.extracted_data?.appointment_date} at{' '}
                      {item.extracted_data?.appointment_time}
                    </div>
                    {item.conflict && (
                      <div className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded">
                        {item.conflict.details?.message}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {statistics && statistics.missing_provider_count > 0 && (
          <TabsContent value="missingProviders" className="space-y-4">
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {categorized.missingProviders.map((item) => (
                <Card key={item.id} className="p-4 border-orange-200 bg-orange-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <span className="font-medium">
                          {item.extracted_data?.patient_name}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Provider: {item.provider_match?.original_provider_name} •{' '}
                        {item.extracted_data?.appointment_date} at{' '}
                        {item.extracted_data?.appointment_time}
                      </div>
                      <div className="text-sm text-orange-700 bg-orange-100 p-2 rounded">
                        Provider not found - will be resolved in next step
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="rejected" className="space-y-4">
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {categorized.rejected.map((item) => (
              <Card key={item.id} className="p-4 border-red-200 bg-red-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="font-medium">
                        Row {item.row_number}
                      </span>
                    </div>
                    {item.validation_errors && item.validation_errors.length > 0 && (
                      <div className="text-sm text-red-700 bg-red-100 p-2 rounded mt-2">
                        {item.validation_errors.map((error, idx) => (
                          <div key={idx}>• {error.message}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue}>
          {statistics && statistics.missing_provider_count > 0
            ? 'Resolve Missing Providers'
            : 'Continue to Confirm'}
        </Button>
      </div>
    </div>
  );
};

export default ReviewStep;
