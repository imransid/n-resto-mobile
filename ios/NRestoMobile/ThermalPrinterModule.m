/**
 * Thermal printer native module — iOS.
 * Builds ESC/POS receipt and sends via TCP (LAN printer).
 * Bluetooth: use setPrinterTarget with type 'bluetooth' and address; requires External Accessory or CoreBluetooth setup.
 */

#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>
#import <CFNetwork/CFNetwork.h>
#import <CoreFoundation/CoreFoundation.h>

@interface ThermalPrinterModule : NSObject <RCTBridgeModule>
@end

@implementation ThermalPrinterModule {
  NSString *_tcpHost;
  NSNumber *_tcpPort;
}

RCT_EXPORT_MODULE(ThermalPrinter)

static const int WIDTH_CHARS = 32;

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(printInvoice:(NSDictionary *)invoice
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  NSString *host = invoice[@"printerHost"] ?: self->_tcpHost;
  NSNumber *port = invoice[@"printerPort"] ?: self->_tcpPort;
  if (!host.length || !port) {
    resolve(@{ @"success": @NO, @"message": @"No printer target. Call setPrinterTarget with type 'tcp', host and port." });
    return;
  }
  NSData *data = [self buildEscPosReceipt:invoice];
  if (!data) {
    resolve(@{ @"success": @NO, @"message": @"Failed to build receipt." });
    return;
  }
  [self sendToTcpHost:host port:port.intValue data:data resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(setPrinterTarget:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  NSString *type = config[@"type"];
  if ([type isEqualToString:@"tcp"]) {
    self->_tcpHost = config[@"host"];
    self->_tcpPort = config[@"port"];
  }
  resolve(nil);
}

RCT_EXPORT_METHOD(getAvailablePrinters:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  resolve(@[]);
}

- (NSString *)formatNum:(double)n {
  NSNumberFormatter *f = [[NSNumberFormatter alloc] init];
  f.numberStyle = NSNumberFormatterDecimalStyle;
  f.minimumFractionDigits = 2;
  f.maximumFractionDigits = 2;
  return [f stringFromNumber:@(n)] ?: [NSString stringWithFormat:@"%.2f", n];
}

- (NSData *)buildEscPosReceipt:(NSDictionary *)invoice {
  NSMutableData *out = [NSMutableData data];
  const int W = WIDTH_CHARS;
  NSString *sep = [@"" stringByPaddingToLength:W withString:@"-" startingAtIndex:0];
  NSString *sepEq = [@"" stringByPaddingToLength:W withString:@"=" startingAtIndex:0];

  void (^emit)(const uint8_t *, NSUInteger) = ^(const uint8_t *bytes, NSUInteger len) {
    [out appendBytes:bytes length:len];
  };
  void (^emitStr)(NSString *) = ^(NSString *s) {
    [out appendData:[s dataUsingEncoding:NSUTF8StringEncoding]];
  };
  void (^lineFeed)(void) = ^{ uint8_t lf = 0x0A; emit(&lf, 1); };
  void (^initPrinter)(void) = ^{ uint8_t cmd[] = { 0x1B, 0x40 }; emit(cmd, 2); };
  void (^boldOn)(void) = ^{ uint8_t cmd[] = { 0x1B, 0x45, 0x01 }; emit(cmd, 3); };
  void (^boldOff)(void) = ^{ uint8_t cmd[] = { 0x1B, 0x45, 0x00 }; emit(cmd, 3); };
  void (^cut)(void) = ^{ uint8_t cmd[] = { 0x1D, 0x56, 0x00 }; emit(cmd, 3); };

  void (^center)(NSString *str) = ^(NSString *str) {
    NSInteger len = [str length];
    NSInteger pad = (W - len) / 2;
    if (pad > 0) emitStr([[@"" stringByPaddingToLength:pad withString:@" " startingAtIndex:0] stringByAppendingString:str]);
    else emitStr(str);
    lineFeed();
  };

  void (^leftRight)(NSString *left, NSString *right) = ^(NSString *left, NSString *right) {
    NSInteger pad = W - (NSInteger)left.length - (NSInteger)right.length;
    if (pad < 1) pad = 1;
    NSString *sp = [@"" stringByPaddingToLength:pad withString:@" " startingAtIndex:0];
    emitStr([[left stringByAppendingString:sp] stringByAppendingString:right]);
    lineFeed();
  };

  initPrinter();
  lineFeed();

  /* Powered By + BOLT Fusion Tech at top */
  center(@"Powered By");
  NSString *poweredByName = invoice[@"poweredByName"];
  if (!poweredByName.length) poweredByName = @"BOLT Fusion Tech";
  if (poweredByName.length > W) poweredByName = [poweredByName substringToIndex:W];
  boldOn();
  center(poweredByName);
  boldOff();
  lineFeed();

  NSString *storeName = invoice[@"storeName"] ?: @"ABC Restaurant";
  if (storeName.length > W) storeName = [storeName substringToIndex:W];
  NSString *date = invoice[@"date"];
  if (date.length) { emitStr(date); lineFeed(); }
  emitStr(storeName);
  lineFeed();
  NSString *storeAddress = invoice[@"storeAddress"];
  if (storeAddress.length) {
    for (NSString *line in [storeAddress componentsSeparatedByString:@"\n"]) {
      NSString *t = [line stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
      if (t.length) { emitStr(t.length > W ? [t substringToIndex:W] : t); lineFeed(); }
    }
  }
  if (storePhone.length) { emitStr([@"Phone " stringByAppendingString:storePhone]); lineFeed(); }
  NSString *servedBy = invoice[@"servedBy"];
  if (!servedBy.length) servedBy = @"Admin";
  emitStr([@"Served by: " stringByAppendingString:servedBy]);
  lineFeed();
  NSString *invoiceNumber = invoice[@"invoiceNumber"];
  if (invoiceNumber.length) { emitStr([@"Order #: " stringByAppendingString:invoiceNumber]); lineFeed(); }
  NSString *customerName = [invoice[@"customerName"] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
  if (customerName.length) { emitStr([@"Customer: " stringByAppendingString:customerName]); lineFeed(); }

  NSNumber *tableNum = invoice[@"tableNumber"];
  NSString *orderTypeLabel = invoice[@"orderTypeLabel"];
  if (!orderTypeLabel.length) orderTypeLabel = @"Dine In";
  NSString *orderTime = invoice[@"orderTime"] ?: @"";
  if (tableNum != nil && [tableNum intValue] > 0) {
    emitStr(orderTime.length ? [NSString stringWithFormat:@"Table: %@  %@", tableNum, orderTime] : [NSString stringWithFormat:@"Table: %@", tableNum]);
  } else {
    emitStr(orderTime.length ? [NSString stringWithFormat:@"%@  %@", orderTypeLabel, orderTime] : orderTypeLabel);
  }
  lineFeed();
  lineFeed();

  NSArray *items = invoice[@"items"];
  if ([items isKindOfClass:[NSArray class]]) {
    for (NSDictionary *item in items) {
      NSString *name = item[@"name"];
      if (!name.length) name = item[@"itemCode"];
      if (!name.length) name = @"Item";
      if (name.length > W - 12) name = [name substringToIndex:W - 12];
      int qty = [item[@"qty"] intValue];
      if (qty < 1) qty = 1;
      double price = [item[@"unitPrice"] doubleValue];
      if (price == 0.0) price = [item[@"price"] doubleValue];
      double lineTotal = [item[@"lineTotal"] doubleValue];
      if (lineTotal == 0.0) lineTotal = price * qty;
      NSString *priceStr = [self formatNum:price];
      NSString *totalStr = [self formatNum:lineTotal];
      NSString *right = (qty > 1) ? [NSString stringWithFormat:@"%d x %@", qty, priceStr] : totalStr;
      leftRight(name, right);
    }
  }
  lineFeed();

  double subtotal = [invoice[@"subtotal"] doubleValue];
  double serviceChargeAmount = [invoice[@"serviceChargeAmount"] doubleValue];
  double taxAmount = [invoice[@"vatAmount"] doubleValue];
  if (taxAmount == 0.0) taxAmount = [invoice[@"tax"] doubleValue];
  double totalAmount = [invoice[@"amountDue"] doubleValue];
  if (totalAmount == 0.0) totalAmount = [invoice[@"total"] doubleValue];
  leftRight(@"Subtotal", [self formatNum:subtotal]);
  if (serviceChargeAmount > 0.0) {
    leftRight(@"Service charge", [self formatNum:serviceChargeAmount]);
  }
  leftRight(@"Tax", [self formatNum:taxAmount]);
  boldOn();
  leftRight(@"Total:", [self formatNum:totalAmount]);
  boldOff();
  emitStr(sepEq);
  lineFeed();
  lineFeed();

  NSString *paymentMethod = invoice[@"paymentMethod"] ?: @"Cash";
  BOOL isCash = [paymentMethod caseInsensitiveCompare:@"Cash"] == NSOrderedSame;
  NSString *payLabel = isCash ? @"Cash:" : @"Other:";
  double payAmount = [invoice[@"amountDue"] doubleValue] ?: [invoice[@"total"] doubleValue];
  double changeAmount = [invoice[@"changeAmount"] doubleValue];
  leftRight(payLabel, [self formatNum:payAmount]);
  leftRight(@"Change:", [self formatNum:changeAmount]);
  emitStr(sep);
  lineFeed();
  lineFeed();

  NSString *poweredBy = invoice[@"poweredBy"];
  if (poweredBy.length) { emitStr(poweredBy); lineFeed(); }
  lineFeed();
  boldOn();
  center(@"Thank You!");
  boldOff();
  lineFeed();
  lineFeed();
  cut();

  return out;
}

- (void)sendToTcpHost:(NSString *)host port:(int)port data:(NSData *)data
               resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    CFReadStreamRef readStream = NULL;
    CFWriteStreamRef writeStream = NULL;
    CFStreamCreatePairWithSocketToHost(kCFAllocatorDefault, (__bridge CFStringRef)host, (UInt32)port, &readStream, &writeStream);
    if (!writeStream) {
      resolve(@{ @"success": @NO, @"message": @"Could not create socket." });
      return;
    }
    NSOutputStream *os = (__bridge_transfer NSOutputStream *)writeStream;
    if (readStream) CFRelease(readStream);
    [os open];
    NSInteger written = [os write:data.bytes maxLength:data.length];
    [os close];
    if (written == data.length) {
      resolve(@{ @"success": @YES });
    } else {
      resolve(@{ @"success": @NO, @"message": [NSString stringWithFormat:@"Wrote %ld of %lu bytes.", (long)written, (unsigned long)data.length] });
    }
  });
}

@end
