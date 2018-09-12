/* @flow */

import { toArray } from '../util/index'

//初始化传说中的vue.use方法,作用是安装Vue插件
export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    /*_installedPlugins是否存在，存在取其值 不存在赋值[]*/
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    //传入的插件是否已经存在于插件集合中,存在返回vue实例 不存在往下走
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
