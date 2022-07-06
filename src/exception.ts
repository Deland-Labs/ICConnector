export enum WalletConnectErrorCode {
  ConnectFailed = 1,
  PlugNotInstall = 10,
  PlugConnectFailed = 11,
  AstroxConnectFailed = 20,
  StoicWalletConnectFailed = 30,
  InfinityWalletNotInstall = 40,
  InfinityWalletConnectFailed = 41,
  NFIDConnectFailed = 50,
  NoExistProvider = 100,
  NotConnected = 101,
  Unknown = 10000
}

export class WalletConnectError extends Error {
  readonly code: number;
  readonly message: string;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.message = message;
    this.name = 'WalletConnectError';
  }
}
