import { Principal } from '@dfinity/principal';
import { WalletConnectError, WalletConnectErrorCode } from './exception';
import { principalToAccountID } from './helper';
import { IDL } from '@dfinity/candid';
import { ActorSubclass } from '@dfinity/agent';
import {
  PlugWalletConnector,
  StoicWalletConnector,
  //AstroXConnector,
  InfinityWalletConnector,
  NFIDConnector
} from './providers';

export enum WalletType {
  AstroX,
  // EarthWallet,
  InfinityWallet,
  // InternetIdentity,
  NFID,
  PlugWallet,
  StoicWallet
}

export interface WalletAuth {
  type: WalletType;
  principal: string;
  accountId: string;
}

export interface IWalletConnector {
  type: WalletType;
  connected: boolean;
  /**
   * connect to the wallet
   * @returns {Promise<WalletAuth>}
   */
  connect: () => Promise<WalletAuth>;
  /**
   * disconnect from the wallet
   * @returns {Promise<void>}
   */
  disconnect: () => Promise<void>;
  createActor: <T>(
    canisterId: string,
    interfaceFactory: IDL.InterfaceFactory
  ) => Promise<ActorSubclass<T>>;
}

export class ICConnector {
  public walletAuth?: WalletAuth;
  private connectors = new Map<WalletType, IWalletConnector>();

  constructor(host: string, whitelist: Array<string>, dev: boolean) {
    // Astrox using @dfinity/agent v0.10.4, so it is not compatible with v0.11.*
    //this.connectors.set(WalletType.AstroX,new AstroXConnector(host, whitelist, dev));
    this.connectors.set(
      WalletType.PlugWallet,
      new PlugWalletConnector(host, whitelist, dev)
    );
    this.connectors.set(
      WalletType.StoicWallet,
      new StoicWalletConnector(host, whitelist, dev)
    );

    this.connectors.set(
      WalletType.InfinityWallet,
      new InfinityWalletConnector(host, whitelist, dev)
    );
    this.connectors.set(
      WalletType.NFID,
      new NFIDConnector(host, whitelist, dev)
    );
  }

  /**
   * connect to a wallet
   * @param walletType the type of the wallet
   * @returns
   */
  public connect = async (walletType: WalletType): Promise<WalletAuth> => {
    const connector = this.connectors.get(walletType);

    if (!connector) {
      throw new WalletConnectError(
        WalletConnectErrorCode.NoExistProvider,
        `No exist provider: ${walletType}`
      );
    }

    console.debug(
      `check: isConnected ${WalletType[walletType]} ${connector.connected}`
    );
    const walletAuth = await connector.connect();

    console.debug(
      `connect ${WalletType[walletType]} success, principal: ${walletAuth.principal}`
    );

    return {
      type: walletType,
      principal: walletAuth.principal,
      accountId: principalToAccountID(Principal.fromText(walletAuth.principal))
    };
  };

  /**
   * create a canister actor with wallet identity
   * @param canisterId
   * @param idl idl of the canister,didjs
   * @returns
   */
  public async createActor<T>(
    canisterId: string,
    idl: IDL.InterfaceFactory,
    walletType: WalletType
  ): Promise<ActorSubclass<T>> {
    const connector = this.connectors.get(walletType);

    if (!connector) {
      throw new WalletConnectError(
        WalletConnectErrorCode.NoExistProvider,
        `No exist provider: ${walletType}`
      );
    }

    if (!connector.connected && !(await connector.connect())) {
      throw new WalletConnectError(
        WalletConnectErrorCode.NotConnected,
        `${WalletType[walletType]} not connected`
      );
    }

    return connector.createActor(canisterId, idl);
  }

  public disconnect = (type: WalletType) => {
    const connector = this.connectors.get(type);
    if (connector) connector.disconnect();
  };
}
