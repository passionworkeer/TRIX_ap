type BarcodeFormatString = 'qr_code';

interface DetectedBarcodeLike {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcodeLike[]>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: BarcodeFormatString[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructorLike;
  }
}

export type BrowserQrScannerErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'no_camera'
  | 'start_failed'
  | 'scan_failed';

export class BrowserQrScannerError extends Error {
  readonly code: BrowserQrScannerErrorCode;

  constructor(code: BrowserQrScannerErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'BrowserQrScannerError';
  }
}

export function toBrowserQrScannerError(
  error: unknown,
  fallbackMessage: string,
): BrowserQrScannerError {
  if (error instanceof BrowserQrScannerError) {
    return error;
  }

  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return new BrowserQrScannerError('permission_denied', '相机权限被拒绝，请允许摄像头访问后重试。');
    }

    if (
      error.name === 'NotFoundError'
      || error.name === 'DevicesNotFoundError'
      || error.name === 'OverconstrainedError'
    ) {
      return new BrowserQrScannerError('no_camera', '未检测到可用摄像头，请改用手动输入配对码。');
    }
  }

  if (error instanceof Error) {
    return new BrowserQrScannerError('start_failed', error.message || fallbackMessage);
  }

  return new BrowserQrScannerError('start_failed', fallbackMessage);
}

const QR_CODE_FORMAT: BarcodeFormatString = 'qr_code';
const DETECTION_INTERVAL_MS = 250;

export class BrowserQrScanner {
  private detector: BarcodeDetectorLike | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private stopped = true;
  private detectInFlight = false;
  private lastDetectAt = 0;
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  async start(params: {
    video: HTMLVideoElement;
    onDetected: (decodedText: string) => void;
    onError?: (error: BrowserQrScannerError) => void;
  }): Promise<void> {
    await this.stop();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new BrowserQrScannerError('unsupported', '当前浏览器无法访问摄像头，请手动输入配对码。');
      }

      const Detector = window.BarcodeDetector;
      if (!Detector) {
        throw new BrowserQrScannerError('unsupported', '当前浏览器不支持原生二维码扫描，请手动输入配对码。');
      }

      const supportedFormats = Detector.getSupportedFormats
        ? await Detector.getSupportedFormats().catch(() => [] as string[])
        : [];
      if (supportedFormats && supportedFormats.length > 0 && !supportedFormats.includes(QR_CODE_FORMAT)) {
        throw new BrowserQrScannerError('unsupported', '当前浏览器不支持二维码扫描，请手动输入配对码。');
      }

      this.stopped = false;
      this.video = params.video;
      this.detector = new Detector({ formats: [QR_CODE_FORMAT] });
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      if (this.stopped) {
        await this.stop();
        return;
      }

      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.setAttribute('playsinline', 'true');
      await this.video.play();

      this.active = true;
      this.lastDetectAt = 0;
      this.scheduleNextFrame(params);
    } catch (error) {
      await this.stop();
      throw toBrowserQrScannerError(error, '无法启动二维码扫描。');
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.active = false;
    this.detectInFlight = false;
    this.lastDetectAt = 0;

    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.detector = null;
  }

  private scheduleNextFrame(params: {
    video: HTMLVideoElement;
    onDetected: (decodedText: string) => void;
    onError?: (error: BrowserQrScannerError) => void;
  }): void {
    this.rafId = window.requestAnimationFrame(() => {
      void this.scanFrame(params);
    });
  }

  private async scanFrame(params: {
    video: HTMLVideoElement;
    onDetected: (decodedText: string) => void;
    onError?: (error: BrowserQrScannerError) => void;
  }): Promise<void> {
    if (this.stopped) {
      return;
    }

    if (
      this.detector
      && !this.detectInFlight
      && params.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && performance.now() - this.lastDetectAt >= DETECTION_INTERVAL_MS
    ) {
      this.detectInFlight = true;
      this.lastDetectAt = performance.now();

      try {
        const results = await this.detector.detect(params.video);
        const decodedText = results.find((entry) => typeof entry.rawValue === 'string' && entry.rawValue.trim())
          ?.rawValue
          ?.trim();

        if (decodedText) {
          await this.stop();
          params.onDetected(decodedText);
          return;
        }
      } catch (error) {
        const normalizedError = new BrowserQrScannerError(
          'scan_failed',
          error instanceof Error && error.message
            ? error.message
            : '二维码扫描失败，请改用手动输入配对码。',
        );
        await this.stop();
        params.onError?.(normalizedError);
        return;
      } finally {
        this.detectInFlight = false;
      }
    }

    this.scheduleNextFrame(params);
  }
}
