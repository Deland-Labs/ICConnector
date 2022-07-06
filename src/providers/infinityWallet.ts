import { WalletConnectError, WalletConnectErrorCode } from '../exception';
import { principalToAccountID } from '../helper';
import { IWalletConnector, WalletAuth, WalletType } from '..';
import { ActorSubclass, Agent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
declare const window: any;
interface InfinityWallet {
  createActor: <T>(args: {
    canisterId: string;
    interfaceFactory: IDL.InterfaceFactory;
  }) => Promise<ActorSubclass<T>>;
  agent: Agent;
  getPrincipal: () => Promise<Principal>;
  isConnected: () => Promise<boolean>;
  disconnect: () => Promise<any>;
  requestConnect: (Config) => Promise<boolean>;
}
export class InfinityWalletConnector implements IWalletConnector {
  public type = WalletType.InfinityWallet;
  public connected: boolean = false;

  private whiteList: Array<string> = [];
  private icHost: string;
  private dev: boolean;
  private ic?: InfinityWallet = undefined;
  constructor(icHost: string, whitelist: string[] = [], dev: boolean = false) {
    this.icHost = icHost;
    this.whiteList = whitelist;
    this.dev = dev;
  }
  connect = async (): Promise<WalletAuth> => {
    if (
      typeof window.ic?.infinityWallet === 'undefined' ||
      !window.ic?.infinityWallet
    ) {
      window.open(
        'https://chrome.google.com/webstore/detail/infinity-wallet/jnldfbidonfeldmalbflbmlebbipcnle',
        '_blank'
      );
      throw new WalletConnectError(
        WalletConnectErrorCode.InfinityWalletNotInstall,
        'InfinityWalletConnector.connect: Infinity wallet not install'
      );
    } else {
      this.ic = window.ic?.infinityWallet;
      try {
        this.connected = await this.ic.isConnected();
        if (!this.connected) {
          this.connected = await this.ic?.requestConnect({
            whitelist: this.whiteList,
            host: this.icHost
          });
        }

        if (!this.connected) {
          throw new WalletConnectError(
            WalletConnectErrorCode.InfinityWalletConnectFailed,
            `InfinityWalletConnector.connect: connect failed`
          );
        }

        console.debug(`InfinityWalletConnector.connect: connected`);
        const principalId = await this.ic.agent.getPrincipal();
        const accountId = principalToAccountID(principalId);
        return {
          type: WalletType.InfinityWallet,
          principal: principalId.toString(),
          accountId
        };
      } catch (error) {
        throw new WalletConnectError(
          WalletConnectErrorCode.InfinityWalletConnectFailed,
          `InfinityWalletConnector.connect: connect failed ${error}`
        );
      }
    }
  };

  createActor = async <T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ) => {
    if (!this.connected || !this.ic) {
      throw new WalletConnectError(
        WalletConnectErrorCode.InfinityWalletConnectFailed,
        `InfinityWalletConnector.createActor: check connect failed`
      );
    }

    if (this.dev) {
      await this.ic.agent.fetchRootKey();
    }

    return this.ic?.createActor<T>({
      canisterId,
      interfaceFactory: idlFactory
    });
  };

  disconnect = async () => {
    await Promise.race([
      new Promise((resolve, reject) => {
        // InfinityWallet disconnect promise never resolves despite being disconnected
        // This is a hacky workaround
        setTimeout(async () => {
          const isConnected = await this.ic?.isConnected();
          if (!isConnected) {
            resolve(isConnected);
          } else {
            reject();
          }
        }, 10);
      }),
      this.ic?.disconnect()
    ]);
  };
}
