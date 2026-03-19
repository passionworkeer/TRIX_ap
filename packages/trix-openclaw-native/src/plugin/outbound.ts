import { sendPayloadTrix, trixOutbound } from '../outbound.js';

export { sendPayloadTrix, trixOutbound };

export function createOutboundAdapter() {
  return trixOutbound;
}
