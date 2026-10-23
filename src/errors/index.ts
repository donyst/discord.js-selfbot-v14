export * from './DJSError.js';
export { Messages } from './Messages.js';
import * as DJSError from './DJSError.js';
import MessagesDefault from './Messages.js';

export default {
  ...DJSError,
  Messages: MessagesDefault,
};
