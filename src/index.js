// @flow
import { observable } from 'mobx'
import classHelpers, { CompositeDisposable, ClassHelpedClass } from 'macro-class-helpers'
import mobxClassHelpers from 'mobx-class-helpers'
import browser from 'detect-browser'

// export mobx helpers
export { action, computed } from 'mobx'
export const val = observable

// export mobx-persist
import { create } from 'mobx-persist'
import { Emitter } from 'sb-event-kit'
export { persist } from 'mobx-persist'
export const persistStore = create({})

let app: ?Object
let dev: ?Emitter

export const emitter = (): Emitter => {
  dev = dev || new Emitter()
  return dev
}

declare class AwesomeStore extends ClassHelpedClass {
  parameters: Array<any>;
  subscriptions: CompositeDisposable;
  setApp: Function;
  createCompositeDisposable: Function;
  __muid__: ?number;
  app: ?Object;
  react: Function;
  watch: Function;
}

export type Store = AwesomeStore

// @store decorator
export function store(Store: Class<{}>, HMR_ID: string) {
  class ProxyStore {
    static HMR_ID = HMR_ID

    constructor(...args) {
      this.subscriptions = this.createCompositeDisposable()
      Store.apply(this, args)
      if (dev) {
        this.__muid__ = Math.random()
        dev.emit('mount', this)
      }
    }

    get app() {
      return app
    }

    setApp(val) {
      app = val
    }

    dispose() {
      this.subscriptions.dispose()

      // auto dispose all model queries
      for (const key of Object.keys(this)) {
        if (key === 'subscriptions') continue
        if (!Object.hasOwnProperty.call(this, key)) continue
        const val = this[key]
        if (!val || typeof val !== 'object') continue

        // auto dispose models
        if (val.constructor.isModel && val.dispose) val.dispose()

        // auto dispose model queries
        if (val.unsubscribe) val.unsubscribe()
      }

      if (Store.prototype.dispose) {
        Store.prototype.dispose.call(this)
      }

      if (dev) dev.emit('unmount', this)
    }
  }

  if (browser.name !== 'safari') {
    Object.defineProperty(ProxyStore, 'name', {
      value: Store.name,
    })
  }

  // set static properties
  // NOTE: Using Object.keys() doesn't give us static class methods, because babel defines them as non-enumerable
  Object.getOwnPropertyNames(Store).forEach(staticProp => {
    if (staticProp !== 'length' && staticProp !== 'name' && staticProp !== 'prototype') {
      ProxyStore[staticProp] = Store[staticProp]
    }
  })

  // class helpers
  classHelpers(
    ProxyStore,
    'ref',
    'addEvent',
    'setTimeout',
    'setInterval',
    'createCompositeDisposable'
  )

  // mobx class helpers
  mobxClassHelpers(
    ProxyStore,
    'react',
    'watch'
  )

  Object.setPrototypeOf(ProxyStore.prototype, Store.prototype)

  return ProxyStore
}
