import { WalletConnectError, WalletConnectErrorCode } from '../exception';
import { principalToAccountID } from '../helper';
import { IWalletConnector, WalletAuth, WalletType } from '..';
import { ActorSubclass, Agent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
declare const window: any;
interface Plug {
  createActor: <T>(args: {
    canisterId: string;
    interfaceFactory: IDL.InterfaceFactory;
  }) => Promise<ActorSubclass<T>>;
  agent: Agent;
  createAgent: (options: {
    host: string;
    whitelist: Array<string>;
  }) => Promise<boolean>;
  getPrincipal: () => Promise<Principal>;
  isConnected: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  requestConnect: (Config) => Promise<boolean>;
  requestTransfer: (args: {
    to: string;
    amount: number;
    opts?: {
      fee?: number;
      memo?: string;
      from_subaccount?: Number;
      created_at_time?: {
        timestamp_nanos: number;
      };
    };
  }) => Promise<{
    height: Number;
  }>;
  requestBalance: () => Promise<
    Array<{
      amount: number;
      canisterId: string;
      decimals: number;
      image?: string;
      name: string;
      symbol: string;
    }>
  >;
  getManagementCanister: () => Promise<ActorSubclass | undefined>;
}
export class PlugWalletConnector implements IWalletConnector {
  public type = WalletType.PlugWallet;
  public connected: boolean = false;

  private whiteList: Array<string> = [];
  private icHost: string;
  private dev: boolean;
  private ic?: Plug = undefined;
  constructor(icHost: string, whitelist: string[] = [], dev: boolean = false) {
    this.icHost = icHost;
    this.whiteList = whitelist;
    this.dev = dev;
  }
  connect = async (): Promise<WalletAuth> => {
    if (typeof window.ic === 'undefined' || !window.ic?.plug) {
      window.open('https://plugwallet.ooo/');
      throw new WalletConnectError(
        WalletConnectErrorCode.PlugNotInstall,
        'Plug not install'
      );
    } else {
      this.ic = window.ic.plug;
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
            WalletConnectErrorCode.PlugConnectFailed,
            `PlugWalletConnector.connect: connect failed`
          );
        }

        if (!this.ic?.agent) await this.initAgent();

        if (!this.ic?.agent) {
          throw new WalletConnectError(
            WalletConnectErrorCode.PlugConnectFailed,
            `PlugWalletConnector.connect: agent initialization failed`
          );
        }

        console.debug(`PlugWalletConnector.connect: connected`);

        const principalId = await this.ic.agent.getPrincipal();
        const accountId = principalToAccountID(principalId);
        return {
          type: WalletType.PlugWallet,
          principal: principalId.toString(),
          accountId
        };
      } catch (error) {
        throw new WalletConnectError(
          WalletConnectErrorCode.PlugConnectFailed,
          `PlugWalletConnector.connect: connect failed ${error}`
        );
      }
    }
  };

  createActor = async <T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ) => {
    if (!this.connected || !this.ic?.agent) {
      throw new WalletConnectError(
        WalletConnectErrorCode.PlugConnectFailed,
        `PlugWalletConnector.createActor: check connect failed`
      );
    }

    if (this.dev) {
      await this.ic?.agent.fetchRootKey();
    }

    return this.ic?.createActor<T>({
      canisterId,
      interfaceFactory: idlFactory
    });
  };

  disconnect = async () => {
    this.ic?.disconnect();
  };

  /**
   * initialize agent
   */
  private initAgent = async () => {
    if (!this.connected) {
      console.warn('PlugWalletConnector.initAgent: plug not connected');
      return;
    }

    if (this.ic?.agent) {
      console.warn('PlugWalletConnector.initAgent: agent already initialized');
      return;
    }
    await this.ic.createAgent({
      whitelist: this.whiteList,
      host: this.icHost
    });
  };
}
