import { WalletConnectError, WalletConnectErrorCode } from '../exception';
import { principalToAccountID } from '../helper';
import { IWalletConnector, WalletAuth, WalletType } from '..';
import { Actor, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
declare const window: any;
export class NFIDConnector implements IWalletConnector {
  public type = WalletType.NFID;
  public connected: boolean = false;

  private icHost: string;
  private appName: string;
  private whiteList: Array<string> = [];
  private providerUrl: string;
  private dev: boolean;
  private client?: any;
  private identity?: any;
  constructor(
    icHost: string,
    whitelist: string[] = [],
    dev: boolean = false,
    providerUrl: string = 'https://3y5ko-7qaaa-aaaal-aaaaq-cai.ic0.app',
    appName: string = 'ICCONNECTOR'
  ) {
    this.icHost = icHost;
    this.whiteList = whitelist;
    this.dev = dev;
    this.providerUrl = providerUrl;
    this.appName = appName;
  }
  connect = async (): Promise<WalletAuth> => {
    try {
      await new Promise((resolve, reject) => {
        this.client.login({
          identityProvider:
            this.providerUrl + `/authenticate/?applicationName=${this.appName}`,
          onSuccess: resolve,
          onError: reject
        });
      });
      this.identity = this.client.getIdentity();

      if (!this.identity) {
        throw new WalletConnectError(
          WalletConnectErrorCode.NFIDConnectFailed,
          'NFIDConnector: connect failed'
        );
      }
      console.debug('NFIDConnector.connect: connected');
      this.connected = true;
      const principal = this.identity.getPrincipal();
      const accountId = principalToAccountID(principal);
      return {
        type: WalletType.NFID,
        principal: principal.toText(),
        accountId
      };
    } catch (error) {
      throw new WalletConnectError(
        WalletConnectErrorCode.NFIDConnectFailed,
        `NFIDConnector.connect: connect failed ${error}`
      );
    }
  };

  createActor = async <T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ) => {
    const agent = new HttpAgent({
      host: this.icHost,
      identity: this.identity
    });

    // Fetch root key for certificate validation during development
    if (this.dev) {
      agent.fetchRootKey().catch(err => {
        console.error(
          'NFIDConnector: Unable to fetch root key. Check to ensure that your local replica is running',
          err
        );
      });
    }

    return Actor.createActor<T>(idlFactory, {
      agent,
      canisterId
    });
  };

  disconnect = async () => {
    await this.client.logout();
  };
}
