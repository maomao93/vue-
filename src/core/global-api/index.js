/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'


export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  //为vue添加只读属性config
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  /*不被认为是公共API的一部分，要避免依赖他们，但是你依然可以使用，只不过风险你要自己控制*/
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  //设置options为原型为空的对象
  Vue.options = Object.create(null)
  /*ASSET_TYPES = [
    'component',
    'directive',
    'filter'
  ]*/
  //为options添加以上三个值为{}(原型为空的对象)的[属性+'s']
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  //混合builtInComponents对象中的属性到Vue.options.components中
  extend(Vue.options.components, builtInComponents)
  /*现在变成Vue.options = {
    components: {
      KeepAlive
    },
    directives: Object.create(null),
    filters: Object.create(null),
    _base: Vue
  }*/

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
