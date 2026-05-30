export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = '未登录或登录已失效') => new HttpError(401, message);
export const forbidden = (message = '没有权限执行该操作') => new HttpError(403, message);
export const notFound = (message = '资源不存在') => new HttpError(404, message);
export const conflict = (message = '资源已存在') => new HttpError(409, message);
