/* @flow */

import { mergeOptions } from '../util/index'

//为vue添加mixin这个全局api
//为什么这个this指向Vue，因为构造函数其实也是对象
//也就是为其添加静态属性罢了,就像对象中的方法属性中
//的this也是指向该对象
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
