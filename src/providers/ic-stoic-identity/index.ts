import { Defer, makeDefer } from 'iterable-observer';
import { Buffer } from 'buffer';
import { Principal } from '@dfinity/principal';
import { requestIdOf } from '@dfinity/agent';
// import { Cbor } from "@dfinity/agent";
import { SignIdentity } from '@dfinity/agent';
import { DelegationChain } from '@dfinity/identity';
import { JsonnableDelegationChain } from '@dfinity/identity/lib/cjs/identity/delegation';

import { bufferToHex, hexToBuffer } from '../../helper';
import { withLogging } from '../../errorLogger';

window.Buffer = Buffer;

const { subtle } = window.crypto;

const domainSeparator = Buffer.from(new TextEncoder().encode('\x0Aic-request'));

type PublicKeyType = 'Standard' | 'DelegationIdentity' | '';

interface StoicApp {
  type: PublicKeyType;
  principal: string;
  key: string | Uint8Array;
  apikey: string;
  secretkey: JsonWebKey;
  signed?: string;
  chain?: string | JsonnableDelegationChain;
}

interface FrameData extends StoicApp {
  success: boolean;
  target: 'STOIC-IFRAME' | 'STOIC-EXT';
  action:
    | 'sign'
    | 'accounts'
    | 'initiateStoicConnect'
    | 'rejectAuthorization'
    | 'confirmAuthorization';
  payload: any;
  sig: string;
  listener: number;
  data: StoicApp;
}

interface Request {
  endpoint: string;
  request: RequestInit;
  body: Record<string, any>;
}

/**
 * Identity
 */
export class PublicKey {
  private _der;
  private _type: PublicKeyType;

  constructor(der, type: PublicKeyType) {
    this._der = der;
    this._type = type;
  }

  getType() {
    return this._type;
  }

  toDer() {
    return this._der;
  }
}

export class StoicIdentity extends SignIdentity {
  private _publicKey: PublicKey;

  constructor(principal: Principal, pubkey: PublicKey) {
    super();
    this._principal = principal;
    this._publicKey = pubkey;
  }

  private static _stoicOrigin = 'https://www.stoicwallet.com';
  private static _stoicApiKey = '';
  private static _stoicApp: StoicApp;
  private static _listener: Defer[] = [];
  private static _frames: HTMLIFrameElement[] = [];
  private static _stoicWindow: Window;
  private static _stoicWindowCB?: Defer<FrameData>;

  static disconnect() {
    localStorage.removeItem('_scApp');
    this._stoicApiKey = '';
    this._stoicApp = null;
  }

  @withLogging
  private static async _stoicLogin(host: string) {
    const app = await this._generateKey();

    this._stoicApiKey = app.apikey;
    this._stoicWindow = window.open(host + '?authorizeApp', 'stoic');
    this._stoicWindowCB = makeDefer();

    const r = await this._stoicWindowCB.promise;

    app.principal = r.principal;
    app.key = r.key;
    app.type = r.type;
    this._stoicApp = app;
    localStorage.setItem('_scApp', JSON.stringify(app));

    return app;
  }

  static async connect(host?: string) {
    if (host) this._stoicOrigin = host;

    const data = await this._stoicLogin(this._stoicOrigin);

    return new StoicIdentity(
      Principal.fromText(data.principal),
      new PublicKey(data.key, data.type)
    );
  }

  static async load(host?: string) {
    if (host) this._stoicOrigin = host;

    const result = this._stoicInit();

    if (result === false) return false;

    const id = new StoicIdentity(
      Principal.fromText(result.principal),
      new PublicKey(result.key, result.type)
    );
    try {
      await id.accounts();
      return id;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  static listen() {
    window.addEventListener(
      'message',
      ({ origin, data }: MessageEvent<FrameData>) => {
        if (origin !== this._stoicOrigin || !data) return;

        if (data.target === 'STOIC-EXT')
          return this.endSend(data.listener, data.data, !data.success);

        switch (data.action) {
          case 'initiateStoicConnect':
            this._stoicWindow.postMessage(
              { action: 'requestAuthorization', apikey: this._stoicApiKey },
              '*'
            );
            break;
          case 'rejectAuthorization':
            this.endAuth(undefined, 'Authorization Rejected');
            break;
          case 'confirmAuthorization':
            this.endAuth(data);
        }
      }
    );
  }

  getPublicKey() {
    return this._publicKey;
  }

  async sign(data: Buffer) {
    return JSON.parse(await this._transport(bufferToHex(data)));
  }

  private _transport(data: string) {
    return this._stoicSign<string>('sign', data, this.getPrincipal().toText());
  }

  accounts() {
    return this._stoicSign<StoicApp>(
      'accounts',
      'accounts',
      this.getPrincipal().toText()
    );
  }

  @withLogging
  async transformRequest({ body, ...fields }: Request) {
    const requestId = requestIdOf(body),
      pubkey = this.getPublicKey(),
      response: Request = { ...fields, body: { content: body } };

    const result = await this.sign(
      Buffer.from(
        Buffer.concat([domainSeparator, Buffer.from(new Uint8Array(requestId))])
      )
    );
    response.body.sender_sig = hexToBuffer(result.signed);

    if (pubkey.getType() === 'DelegationIdentity') {
      const { publicKey, delegations } = DelegationChain.fromJSON(result.chain);

      response.body.sender_pubkey = publicKey;
      response.body.sender_delegation = delegations;
    } else
      response.body.sender_pubkey = new Uint8Array(
        Object.values(pubkey.toDer())
      );
    return response;
  }

  private static _stoicInit() {
    this._stoicApp = JSON.parse(localStorage.getItem('_scApp'));
    return this._stoicApp || false;
  }

  async _stoicSign<T>(
    action: 'sign' | 'accounts',
    payload: string,
    principal: string
  ) {
    const encdata = new TextEncoder().encode(payload);
    const privk = await subtle.importKey(
      'jwk',
      StoicIdentity._stoicApp.secretkey,
      { name: 'ECDSA', namedCurve: 'P-384' },
      true,
      ['sign']
    );
    const signed = await subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-384' }
      },
      privk,
      encdata
    );
    const sig = bufferToHex(signed);

    return this._postToFrame<T>({
      target: 'STOIC-IFRAME',
      action,
      payload,
      principal,
      apikey: StoicIdentity._stoicApp.apikey,
      sig
    });
  }

  private static async _generateKey(): Promise<StoicApp> {
    const { publicKey, privateKey } = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-384' },
      true,
      ['sign', 'verify']
    );
    const pubk = await subtle.exportKey('spki', publicKey);
    const secretkey = await subtle.exportKey('jwk', privateKey);

    return {
      principal: '',
      key: '',
      type: '',
      secretkey,
      apikey: bufferToHex(pubk)
    };
  }

  @withLogging
  private _postToFrame<T>(data: Record<string, any>) {
    const defer = makeDefer<T>();
    const thisIndex = StoicIdentity._listener.push(defer) - 1;

    const ii = document.createElement('iframe');
    ii.id = 'connect_iframe' + thisIndex;
    ii.style.width = ii.style.height = ii.style.border = '0';
    document.body.append(ii);

    StoicIdentity._frames.push(ii);

    ii.addEventListener('load', function () {
      data.listener = thisIndex;
      ii.contentWindow.postMessage(data, '*');
    });
    ii.src = StoicIdentity._stoicOrigin + '/?stoicTunnel';

    return defer.promise;
  }

  static endSend(index: number, data: StoicApp, error?: any) {
    if (!error) this._listener[index].resolve(data);
    else this._listener[index].reject(error);

    this._frames[index].remove();
  }

  static endAuth(data?: FrameData, error?: any) {
    if (data) this._stoicWindowCB.resolve(data);
    else this._stoicWindowCB.reject(error);

    this._stoicWindowCB = undefined;
    this._stoicWindow.close();
  }
}

/* const deserialize = (d) => {
  return Cbor.decode(hex2buf(d));
};
const serialize = (d) => {
  return buf2hex(Cbor.encode(d));
}; */

StoicIdentity.listen();
