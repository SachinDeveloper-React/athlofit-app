//
//  HealthKitAuth.m
//  Athlofit
//
//  Full HealthKit native module using Promises for RN 0.84 New Architecture.
//  Replaces react-native-health which doesn't load under bridgeless mode.
//

#import <React/RCTBridgeModule.h>
#import <HealthKit/HealthKit.h>

@interface HealthKitAuth : NSObject <RCTBridgeModule>
@property (nonatomic, strong) HKHealthStore *healthStore;
@end

@implementation HealthKitAuth

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (HKHealthStore *)store {
  if (!_healthStore) {
    _healthStore = [[HKHealthStore alloc] init];
  }
  return _healthStore;
}

#pragma mark - Authorization

RCT_EXPORT_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![HKHealthStore isHealthDataAvailable]) {
    resolve(@(NO));
    return;
  }

  NSSet *readTypes = [NSSet setWithObjects:
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierStepCount],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierActiveEnergyBurned],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierHeartRate],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureSystolic],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureDiastolic],
    [HKObjectType categoryTypeForIdentifier:HKCategoryTypeIdentifierSleepAnalysis],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierDistanceWalkingRunning],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBodyMass],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodGlucose],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierDietaryWater],
    [HKObjectType workoutType],
    nil];

  NSSet *writeTypes = [NSSet setWithObjects:
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierStepCount],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierActiveEnergyBurned],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierHeartRate],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureSystolic],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureDiastolic],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBodyMass],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodGlucose],
    [HKObjectType categoryTypeForIdentifier:HKCategoryTypeIdentifierSleepAnalysis],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierDietaryWater],
    [HKObjectType quantityTypeForIdentifier:HKQuantityTypeIdentifierDistanceWalkingRunning],
    [HKObjectType workoutType],
    nil];

  [[self store] requestAuthorizationToShareTypes:writeTypes
                                       readTypes:readTypes
                                      completion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) {
        reject(@"HEALTHKIT_AUTH", error.localizedDescription, error);
      } else {
        resolve(@(success));
      }
    });
  }];
}

#pragma mark - Authorization Status Check

/**
 * Checks if write authorization has been granted for key data types.
 * Apple allows querying write (share) authorization status.
 * Returns YES if at least Steps write permission is authorized.
 * This is used to verify whether the user actually granted permissions
 * after requestAuthorization (which always returns success=YES on iOS).
 */
RCT_EXPORT_METHOD(getWritePermissionStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![HKHealthStore isHealthDataAvailable]) {
    resolve(@"unavailable");
    return;
  }

  HKQuantityType *stepType = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierStepCount];
  HKAuthorizationStatus status = [[self store] authorizationStatusForType:stepType];

  switch (status) {
    case HKAuthorizationStatusSharingAuthorized:
      resolve(@"granted");
      break;
    case HKAuthorizationStatusSharingDenied:
      resolve(@"denied");
      break;
    case HKAuthorizationStatusNotDetermined:
    default:
      resolve(@"not_determined");
      break;
  }
}

#pragma mark - Steps

RCT_EXPORT_METHOD(getStepCount:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *stepType = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierStepCount];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];

  HKStatisticsQuery *query = [[HKStatisticsQuery alloc]
    initWithQuantityType:stepType
    quantitySamplePredicate:predicate
    options:HKStatisticsOptionCumulativeSum
    completionHandler:^(HKStatisticsQuery *q, HKStatistics *result, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error) {
          resolve(@(0));
          return;
        }
        double steps = [result.sumQuantity doubleValueForUnit:[HKUnit countUnit]];
        resolve(@(steps));
      });
    }];
  [[self store] executeQuery:query];
}

RCT_EXPORT_METHOD(saveSteps:(double)count
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *stepType = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierStepCount];
  HKQuantity *qty = [HKQuantity quantityWithUnit:[HKUnit countUnit] doubleValue:count];
  NSDate *now = [NSDate date];
  HKQuantitySample *sample = [HKQuantitySample quantitySampleWithType:stepType quantity:qty startDate:now endDate:now];
  [[self store] saveObject:sample withCompletion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) reject(@"SAVE_STEPS", error.localizedDescription, error);
      else resolve(@(YES));
    });
  }];
}

#pragma mark - Calories (Active Energy Burned)

RCT_EXPORT_METHOD(getActiveEnergyBurned:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierActiveEnergyBurned];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];

  HKStatisticsQuery *query = [[HKStatisticsQuery alloc]
    initWithQuantityType:type
    quantitySamplePredicate:predicate
    options:HKStatisticsOptionCumulativeSum
    completionHandler:^(HKStatisticsQuery *q, HKStatistics *result, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !result.sumQuantity) {
          resolve(@(0));
          return;
        }
        double cal = [result.sumQuantity doubleValueForUnit:[HKUnit kilocalorieUnit]];
        resolve(@(cal));
      });
    }];
  [[self store] executeQuery:query];
}

#pragma mark - Heart Rate

RCT_EXPORT_METHOD(getHeartRateSamples:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierHeartRate];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];
  NSSortDescriptor *sort = [NSSortDescriptor sortDescriptorWithKey:HKSampleSortIdentifierStartDate ascending:YES];

  HKSampleQuery *query = [[HKSampleQuery alloc]
    initWithSampleType:type predicate:predicate limit:HKObjectQueryNoLimit sortDescriptors:@[sort]
    resultsHandler:^(HKSampleQuery *q, NSArray *results, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !results.count) {
          resolve(@{@"avg": @(0), @"min": @(0), @"max": @(0)});
          return;
        }
        HKUnit *bpmUnit = [[HKUnit countUnit] unitDividedByUnit:[HKUnit minuteUnit]];
        double sum = 0, minVal = DBL_MAX, maxVal = 0;
        for (HKQuantitySample *s in results) {
          double v = [s.quantity doubleValueForUnit:bpmUnit];
          sum += v;
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
        double avg = sum / results.count;
        resolve(@{@"avg": @(avg), @"min": @(minVal), @"max": @(maxVal)});
      });
    }];
  [[self store] executeQuery:query];
}

RCT_EXPORT_METHOD(saveHeartRate:(double)bpm
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierHeartRate];
  HKUnit *bpmUnit = [[HKUnit countUnit] unitDividedByUnit:[HKUnit minuteUnit]];
  HKQuantity *qty = [HKQuantity quantityWithUnit:bpmUnit doubleValue:bpm];
  NSDate *now = [NSDate date];
  NSDate *start = [NSDate dateWithTimeIntervalSinceNow:-60];
  HKQuantitySample *sample = [HKQuantitySample quantitySampleWithType:type quantity:qty startDate:start endDate:now];
  [[self store] saveObject:sample withCompletion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) reject(@"SAVE_HR", error.localizedDescription, error);
      else resolve(@(YES));
    });
  }];
}

#pragma mark - Blood Pressure

RCT_EXPORT_METHOD(getBloodPressureSamples:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKCorrelationType *bpType = [HKCorrelationType correlationTypeForIdentifier:HKCorrelationTypeIdentifierBloodPressure];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];
  NSSortDescriptor *sort = [NSSortDescriptor sortDescriptorWithKey:HKSampleSortIdentifierStartDate ascending:NO];

  HKSampleQuery *query = [[HKSampleQuery alloc]
    initWithSampleType:bpType predicate:predicate limit:1 sortDescriptors:@[sort]
    resultsHandler:^(HKSampleQuery *q, NSArray *results, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !results.count) {
          resolve(@{@"systolic": @(0), @"diastolic": @(0)});
          return;
        }
        HKCorrelation *bp = (HKCorrelation *)results.firstObject;
        HKQuantityType *sysType = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureSystolic];
        HKQuantityType *diaType = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureDiastolic];
        HKQuantitySample *sys = [[bp objectsForType:sysType] anyObject];
        HKQuantitySample *dia = [[bp objectsForType:diaType] anyObject];
        double sysVal = sys ? [sys.quantity doubleValueForUnit:[HKUnit millimeterOfMercuryUnit]] : 0;
        double diaVal = dia ? [dia.quantity doubleValueForUnit:[HKUnit millimeterOfMercuryUnit]] : 0;
        resolve(@{@"systolic": @(sysVal), @"diastolic": @(diaVal)});
      });
    }];
  [[self store] executeQuery:query];
}

RCT_EXPORT_METHOD(saveBloodPressure:(double)systolic
                  diastolic:(double)diastolic
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *sysType = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureSystolic];
  HKQuantityType *diaType = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodPressureDiastolic];
  HKUnit *mmHg = [HKUnit millimeterOfMercuryUnit];
  NSDate *now = [NSDate date];

  HKQuantitySample *sysSample = [HKQuantitySample quantitySampleWithType:sysType
    quantity:[HKQuantity quantityWithUnit:mmHg doubleValue:systolic] startDate:now endDate:now];
  HKQuantitySample *diaSample = [HKQuantitySample quantitySampleWithType:diaType
    quantity:[HKQuantity quantityWithUnit:mmHg doubleValue:diastolic] startDate:now endDate:now];

  HKCorrelationType *bpType = [HKCorrelationType correlationTypeForIdentifier:HKCorrelationTypeIdentifierBloodPressure];
  HKCorrelation *bp = [HKCorrelation correlationWithType:bpType startDate:now endDate:now objects:[NSSet setWithObjects:sysSample, diaSample, nil]];

  [[self store] saveObject:bp withCompletion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) reject(@"SAVE_BP", error.localizedDescription, error);
      else resolve(@(YES));
    });
  }];
}

#pragma mark - Sleep

RCT_EXPORT_METHOD(getSleepSamples:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKCategoryType *type = [HKCategoryType categoryTypeForIdentifier:HKCategoryTypeIdentifierSleepAnalysis];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];
  NSSortDescriptor *sort = [NSSortDescriptor sortDescriptorWithKey:HKSampleSortIdentifierStartDate ascending:YES];

  HKSampleQuery *query = [[HKSampleQuery alloc]
    initWithSampleType:type predicate:predicate limit:HKObjectQueryNoLimit sortDescriptors:@[sort]
    resultsHandler:^(HKSampleQuery *q, NSArray *results, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !results.count) {
          resolve(@(0));
          return;
        }
        double totalSeconds = 0;
        for (HKCategorySample *s in results) {
          // value == 1 is HKCategoryValueSleepAnalysisAsleep
          if (s.value == HKCategoryValueSleepAnalysisAsleepUnspecified ||
              s.value == HKCategoryValueSleepAnalysisAsleepCore ||
              s.value == HKCategoryValueSleepAnalysisAsleepDeep ||
              s.value == HKCategoryValueSleepAnalysisAsleepREM) {
            totalSeconds += [s.endDate timeIntervalSinceDate:s.startDate];
          }
        }
        double hours = totalSeconds / 3600.0;
        resolve(@(hours));
      });
    }];
  [[self store] executeQuery:query];
}

RCT_EXPORT_METHOD(saveSleep:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKCategoryType *type = [HKCategoryType categoryTypeForIdentifier:HKCategoryTypeIdentifierSleepAnalysis];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  HKCategorySample *sample = [HKCategorySample categorySampleWithType:type value:HKCategoryValueSleepAnalysisAsleepUnspecified startDate:start endDate:end];
  [[self store] saveObject:sample withCompletion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) reject(@"SAVE_SLEEP", error.localizedDescription, error);
      else resolve(@(YES));
    });
  }];
}

#pragma mark - Distance

RCT_EXPORT_METHOD(getDistanceWalkingRunning:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierDistanceWalkingRunning];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];

  HKStatisticsQuery *query = [[HKStatisticsQuery alloc]
    initWithQuantityType:type
    quantitySamplePredicate:predicate
    options:HKStatisticsOptionCumulativeSum
    completionHandler:^(HKStatisticsQuery *q, HKStatistics *result, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !result.sumQuantity) {
          resolve(@(0));
          return;
        }
        double km = [result.sumQuantity doubleValueForUnit:[HKUnit meterUnitWithMetricPrefix:HKMetricPrefixKilo]];
        resolve(@(km));
      });
    }];
  [[self store] executeQuery:query];
}

#pragma mark - Weight

RCT_EXPORT_METHOD(getLatestWeight:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBodyMass];
  NSSortDescriptor *sort = [NSSortDescriptor sortDescriptorWithKey:HKSampleSortIdentifierStartDate ascending:NO];

  HKSampleQuery *query = [[HKSampleQuery alloc]
    initWithSampleType:type predicate:nil limit:1 sortDescriptors:@[sort]
    resultsHandler:^(HKSampleQuery *q, NSArray *results, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !results.count) {
          resolve(@(0));
          return;
        }
        HKQuantitySample *s = results.firstObject;
        double kg = [s.quantity doubleValueForUnit:[HKUnit gramUnitWithMetricPrefix:HKMetricPrefixKilo]];
        resolve(@(kg));
      });
    }];
  [[self store] executeQuery:query];
}

RCT_EXPORT_METHOD(saveWeight:(double)kg
                  date:(NSString *)dateStr
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBodyMass];
  HKUnit *unit = [HKUnit gramUnitWithMetricPrefix:HKMetricPrefixKilo];
  HKQuantity *qty = [HKQuantity quantityWithUnit:unit doubleValue:kg];
  NSDate *date = [self dateFromISO:dateStr];
  HKQuantitySample *sample = [HKQuantitySample quantitySampleWithType:type quantity:qty startDate:date endDate:date];
  [[self store] saveObject:sample withCompletion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) reject(@"SAVE_WEIGHT", error.localizedDescription, error);
      else resolve(@(YES));
    });
  }];
}

#pragma mark - Blood Glucose

RCT_EXPORT_METHOD(getBloodGlucoseSamples:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodGlucose];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];
  NSSortDescriptor *sort = [NSSortDescriptor sortDescriptorWithKey:HKSampleSortIdentifierStartDate ascending:NO];

  HKSampleQuery *query = [[HKSampleQuery alloc]
    initWithSampleType:type predicate:predicate limit:1 sortDescriptors:@[sort]
    resultsHandler:^(HKSampleQuery *q, NSArray *results, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !results.count) {
          resolve(@(0));
          return;
        }
        HKQuantitySample *s = results.firstObject;
        // mmol/L
        HKUnit *unit = [[HKUnit moleUnitWithMetricPrefix:HKMetricPrefixMilli molarMass:HKUnitMolarMassBloodGlucose] unitDividedByUnit:[HKUnit literUnit]];
        double val = [s.quantity doubleValueForUnit:unit];
        resolve(@(val));
      });
    }];
  [[self store] executeQuery:query];
}

RCT_EXPORT_METHOD(saveBloodGlucose:(double)mmol
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierBloodGlucose];
  HKUnit *unit = [[HKUnit moleUnitWithMetricPrefix:HKMetricPrefixMilli molarMass:HKUnitMolarMassBloodGlucose] unitDividedByUnit:[HKUnit literUnit]];
  HKQuantity *qty = [HKQuantity quantityWithUnit:unit doubleValue:mmol];
  NSDate *now = [NSDate date];
  HKQuantitySample *sample = [HKQuantitySample quantitySampleWithType:type quantity:qty startDate:now endDate:now];
  [[self store] saveObject:sample withCompletion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) reject(@"SAVE_GLUCOSE", error.localizedDescription, error);
      else resolve(@(YES));
    });
  }];
}

#pragma mark - Hydration (Water)

RCT_EXPORT_METHOD(getWaterSamples:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierDietaryWater];
  NSDate *start = [self dateFromISO:startDate];
  NSDate *end = [self dateFromISO:endDate];
  NSPredicate *predicate = [HKQuery predicateForSamplesWithStartDate:start endDate:end options:HKQueryOptionStrictStartDate];

  HKStatisticsQuery *query = [[HKStatisticsQuery alloc]
    initWithQuantityType:type
    quantitySamplePredicate:predicate
    options:HKStatisticsOptionCumulativeSum
    completionHandler:^(HKStatisticsQuery *q, HKStatistics *result, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !result.sumQuantity) {
          resolve(@(0));
          return;
        }
        double ml = [result.sumQuantity doubleValueForUnit:[HKUnit literUnit]] * 1000.0;
        resolve(@(ml));
      });
    }];
  [[self store] executeQuery:query];
}

RCT_EXPORT_METHOD(saveWater:(double)ml
                  date:(NSString *)dateStr
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  HKQuantityType *type = [HKQuantityType quantityTypeForIdentifier:HKQuantityTypeIdentifierDietaryWater];
  HKUnit *unit = [HKUnit literUnit];
  HKQuantity *qty = [HKQuantity quantityWithUnit:unit doubleValue:ml / 1000.0];
  NSDate *date = [self dateFromISO:dateStr];
  HKQuantitySample *sample = [HKQuantitySample quantitySampleWithType:type quantity:qty startDate:date endDate:date];
  [[self store] saveObject:sample withCompletion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) reject(@"SAVE_WATER", error.localizedDescription, error);
      else resolve(@(YES));
    });
  }];
}

#pragma mark - Helpers

- (NSDate *)dateFromISO:(NSString *)isoString {
  NSISO8601DateFormatter *fmt = [[NSISO8601DateFormatter alloc] init];
  fmt.formatOptions = NSISO8601DateFormatWithInternetDateTime | NSISO8601DateFormatWithFractionalSeconds;
  NSDate *date = [fmt dateFromString:isoString];
  if (!date) {
    // Fallback without fractional seconds
    fmt.formatOptions = NSISO8601DateFormatWithInternetDateTime;
    date = [fmt dateFromString:isoString];
  }
  return date ?: [NSDate date];
}

@end
