// import { IC } from '@astrox/connection';
// import type { IDL } from '@dfinity/candid';
// import { PermissionsType } from '@astrox/connection/lib/esm/types';
// import { IWalletConnector, WalletAuth, WalletType } from '..';
// import { principalToAccountID } from '../helper';
// import { Principal } from '@dfinity/principal';
// import { WalletConnectError, WalletConnectErrorCode } from '../exception';

// export class AstroXConnector implements IWalletConnector {
//   public type = WalletType.AstroX;
//   public connected: boolean = false;

//   private whiteList: Array<string> = [];
//   private providerUrl: string = '';
//   private ledgerHost: string;
//   private ledgerCanisterId: string;
//   private icHost: string;
//   private dev: boolean;
//   private astrox?: IC = undefined;
//   constructor(
//     icHost: string,
//     whitelist: string[] = [],
//     dev: boolean = false,
//     providerUrl = 'https://63k2f-nyaaa-aaaah-aakla-cai.raw.ic0.app',
//     ledgerHost = 'https://boundary.ic0.app/',
//     ledgerCanisterId = 'ryjl3-tyaaa-aaaaa-aaaba-cai'
//   ) {
//     this.whiteList = whitelist;
//     this.providerUrl = this.icHost = icHost;
//     this.dev = dev;
//     this.providerUrl = providerUrl;
//     this.ledgerHost = ledgerHost;
//     this.ledgerCanisterId = ledgerCanisterId;
//     this.initializeIC();
//   }
//   connect = async (): Promise<WalletAuth> => {
//     if (!this.astrox) {
//       throw new WalletConnectError(
//         WalletConnectErrorCode.AstroxConnectFailed,
//         'Astrox.connect: IC not initialized'
//       );
//     }

//     await this.astrox.connect({
//       useFrame: !(window.innerWidth < 768),
//       signerProviderUrl: `${this.providerUrl}/signer`,
//       walletProviderUrl: `${this.providerUrl}/transaction`,
//       identityProvider: `${this.providerUrl}/login#authorize`,
//       permissions: [PermissionsType.identity, PermissionsType.wallet],
//       ledgerCanisterId: this.ledgerCanisterId,
//       onAuthenticated: (icInstance: IC) => {
//         this.astrox = window.ic.astrox ?? icInstance;
//       },
//       onSuccess: () => {
//         console.debug('AstroxConnector.connect: onSuccess');
//         this.connected = true;
//       },
//       onError: (error: string) => {
//         console.error(`AstroxConnector.connect: onError ${error}`);
//         this.connected = false;
//       }
//     });

//     if (!this.astrox?.principal) {
//       throw new WalletConnectError(
//         WalletConnectErrorCode.AstroxConnectFailed,
//         'AstroxConnector.connect: IC principal is undefined'
//       );
//     }
//     const principal = this.astrox.principal.toText();
//     return {
//       type: WalletType.AstroX,
//       principal,
//       accountId: principalToAccountID(Principal.fromText(principal))
//     };
//   };

//   createActor = async <T>(
//     canisterId: string,
//     idlFactory: IDL.InterfaceFactory
//   ) => {
//     if (!this.connected || !this.astrox) {
//       throw new WalletConnectError(
//         WalletConnectErrorCode.PlugConnectFailed,
//         `AstroxConnector.createActor: check connect failed`
//       );
//     }
//     return this.astrox?.createActor<T>(idlFactory as any, canisterId);
//   };

//   disconnect = async () => {
//     await this.astrox?.disconnect();
//   };

//   /**
//    * initialize agent
//    */
//   private initializeIC = async () => {
//     this.astrox = await IC.create({
//       useFrame: !(window.innerWidth < 768),
//       signerProviderUrl: `${this.providerUrl}/signer`,
//       walletProviderUrl: `${this.providerUrl}/transaction`,
//       identityProvider: `${this.providerUrl}/login#authorize`,
//       permissions: [PermissionsType.identity, PermissionsType.wallet],
//       ledgerCanisterId: this.ledgerCanisterId,
//       ledgerHost: this.ledgerHost,
//       onAuthenticated: (icInstance: IC) => {
//         this.astrox = (window.ic.astrox as IC) ?? icInstance;
//       },
//       dev: this.dev
//     });
//   };
// }
