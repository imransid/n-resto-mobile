/**
 * Image download native module — runs all downloads on a background queue.
 * Saves into the app's Document directory: Documents/NRestoMobile/itemId.ext.
 * JS passes array of { imageUrl, itemId }; returns [{ itemId, localPath }].
 */
#import <React/RCTBridgeModule.h>
#import <React/RCTBridge.h>
#import <Foundation/Foundation.h>

@interface ImageDownloadModule : NSObject <RCTBridgeModule>
@end

@implementation ImageDownloadModule

RCT_EXPORT_MODULE(ImageDownload)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSString *)documentsImageDirPath {
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  NSString *documents = paths.firstObject;
  if (!documents.length) return nil;
  NSString *subfolder = [documents stringByAppendingPathComponent:@"NRestoMobile"];
  NSFileManager *fm = [NSFileManager defaultManager];
  if (![fm fileExistsAtPath:subfolder]) {
    [fm createDirectoryAtPath:subfolder withIntermediateDirectories:YES attributes:nil error:nil];
  }
  return subfolder;
}

RCT_EXPORT_METHOD(downloadImages:(NSArray *)items
                  imagesDir:(NSString *)imagesDir
                  authorization:(NSString *)authorization
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSString *folderPath = nil;
    if (imagesDir && [imagesDir isKindOfClass:[NSString class]] && imagesDir.length > 0) {
      NSFileManager *fm = [NSFileManager defaultManager];
      if (![fm fileExistsAtPath:imagesDir]) {
        [fm createDirectoryAtPath:imagesDir withIntermediateDirectories:YES attributes:nil error:nil];
      }
      folderPath = imagesDir;
    } else {
      folderPath = [self documentsImageDirPath];
    }
    if (!folderPath.length) {
      resolve(@[]);
      return;
    }
    NSString *authHeader = ([authorization isKindOfClass:[NSString class]] && authorization.length)
      ? [authorization stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]]
      : nil;
    NSMutableArray *results = [NSMutableArray array];
    for (NSDictionary *item in items) {
      NSString *imageUrl = item[@"imageUrl"];
      NSString *itemId = item[@"itemId"];
      if (![imageUrl isKindOfClass:[NSString class]] || !imageUrl.length ||
          ![itemId isKindOfClass:[NSString class]] || !itemId.length) continue;
      NSString *localPath = [self downloadOne:imageUrl itemId:itemId folderPath:folderPath authorization:authHeader];
      if (localPath.length) {
        [results addObject:@{ @"itemId": itemId, @"localPath": localPath }];
      }
    }
    resolve(results);
  });
}

- (NSString *)extensionFromUrl:(NSString *)url {
  NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"\\.([a-zA-Z0-9]+)(?:\\?|$)"
                                                                         options:0 error:nil];
  NSTextCheckingResult *match = [regex firstMatchInString:url options:0 range:NSMakeRange(0, url.length)];
  if (match && match.numberOfRanges > 1) {
    NSString *ext = [url substringWithRange:[match rangeAtIndex:1]];
    return [NSString stringWithFormat:@".%@", [ext lowercaseString]];
  }
  return @".jpg";
}

- (NSString *)downloadOne:(NSString *)imageUrl itemId:(NSString *)itemId folderPath:(NSString *)folderPath authorization:(NSString *)authorization {
  NSURL *url = [NSURL URLWithString:imageUrl];
  if (!url) return nil;
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  [request setHTTPMethod:@"GET"];
  [request setTimeoutInterval:20];
  if (authorization.length) {
    [request setValue:authorization forHTTPHeaderField:@"Authorization"];
  }
  NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
  config.timeoutIntervalForRequest = 20;
  config.timeoutIntervalForResource = 60;
  NSURLSession *session = [NSURLSession sessionWithConfiguration:config];
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  __block NSData *data = nil;
  __block NSInteger statusCode = 0;
  [[session dataTaskWithRequest:request completionHandler:^(NSData *d, NSURLResponse *r, NSError *e) {
    if ([r isKindOfClass:[NSHTTPURLResponse class]]) statusCode = [(NSHTTPURLResponse *)r statusCode];
    if (!e && statusCode == 200 && d.length) data = d;
    dispatch_semaphore_signal(sema);
  }] resume];
  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
  [session finishTasksAndInvalidate];
  if (!data.length) return nil;
  NSString *ext = [self extensionFromUrl:imageUrl];
  NSCharacterSet *allowed = [NSCharacterSet characterSetWithCharactersInString:@"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"];
  NSCharacterSet *bad = allowed.invertedSet;
  NSString *safeId = [[itemId componentsSeparatedByCharactersInSet:bad] componentsJoinedByString:@"_"];
  if (!safeId.length) safeId = @"item";
  NSString *filename = [NSString stringWithFormat:@"%@%@", safeId, ext];
  NSString *filePath = [folderPath stringByAppendingPathComponent:filename];
  if ([data writeToFile:filePath atomically:YES]) return filePath;
  return nil;
}

@end
