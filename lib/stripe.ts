import Stripe from 'stripe'
import { appEnv } from './env'

/**
 * Workers上でStripeを使うための設定。Node標準のhttp/cryptoモジュールが
 * 無いため、fetchベースのHTTPクライアントとWebCryptoベースの署名検証を
 * 明示的に指定する。
 * 参照: docs/design/06-billing-payments.md §6.4
 */
export function getStripe(): Stripe {
  return new Stripe(appEnv().STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: 'Parking Management App', version: '0.2.0' },
  })
}

/** Webhookの署名検証（`constructEventAsync`）に渡すWebCryptoプロバイダ。 */
export const webCrypto = Stripe.createSubtleCryptoProvider()
