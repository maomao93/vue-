/* @flow */

import { mergeOptions } from '../util/index'

//为vue添加mixin这个全局api
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
