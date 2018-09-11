/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;//只有在创建Watcher实例并且不为计算属性的时候target才会存在值
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null
const targetStack = []

//不是计算属性的时候会触发
export function pushTarget (_target: ?Watcher) {
  //Dep.target存在
  if (Dep.target) targetStack.push(Dep.target)
  //将传入的Watcher赋值给Dep.target
  Dep.target = _target
}

//不是计算属性的时候会触发
export function popTarget () {
  //删除并返回数组的最后一个元素,把(最后一个Watcher实例或undefined)赋值给Dep.target
  Dep.target = targetStack.pop()
}
