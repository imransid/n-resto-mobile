/**
 * Serial queue + Network.framework path monitor. Emits connectivity only — no DB/HTTP here.
 */
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <Network/Network.h>

@interface OrderSyncMonitor : RCTEventEmitter
@property (nonatomic, assign) nw_path_monitor_t pathMonitor;
@property (nonatomic, strong) dispatch_queue_t serialQueue;
@end

@implementation OrderSyncMonitor

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"OrderSyncMonitorConnectivity"];
}

- (instancetype)init {
  if (self = [super init]) {
    _serialQueue = dispatch_queue_create("com.nrestomobile.OrderSyncMonitor", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (void)startObserving {
  [self stopObserving];
  nw_path_monitor_t mon = nw_path_monitor_create();
  if (mon == NULL) {
    return;
  }
  self.pathMonitor = mon;
  nw_path_monitor_set_queue(mon, self.serialQueue);
  __weak typeof(self) weakSelf = self;
  nw_path_monitor_set_update_handler(mon, ^(nw_path_t path) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) {
      return;
    }
    bool online = nw_path_get_status(path) == nw_path_status_satisfied;
    NSDictionary *body = @{@"online": @(online)};
    dispatch_async(dispatch_get_main_queue(), ^{
      [strongSelf sendEventWithName:@"OrderSyncMonitorConnectivity" body:body];
    });
  });
  nw_path_monitor_start(mon);
}

- (void)stopObserving {
  if (self.pathMonitor) {
    nw_path_monitor_cancel(self.pathMonitor);
    self.pathMonitor = NULL;
  }
}

- (void)dealloc {
  if (self.pathMonitor) {
    nw_path_monitor_cancel(self.pathMonitor);
    self.pathMonitor = NULL;
  }
}

@end
