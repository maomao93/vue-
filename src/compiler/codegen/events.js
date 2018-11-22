/* @flow */

const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/

// KeyboardEvent.keyCode aliases
const keyCodes: { [key: string]: number | Array<number> } = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  'delete': [8, 46]
}

// KeyboardEvent.key aliases
const keyNames: { [key: string]: string | Array<string> } = {
  // #7880: IE11 and Edge use `Esc` for Escape key name.
  esc: ['Esc', 'Escape'],
  tab: 'Tab',
  enter: 'Enter',
  space: ' ',
  // #7806: IE11 uses key names without `Arrow` prefix for arrow keys.
  up: ['Up', 'ArrowUp'],
  left: ['Left', 'ArrowLeft'],
  right: ['Right', 'ArrowRight'],
  down: ['Down', 'ArrowDown'],
  'delete': ['Backspace', 'Delete']
}

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
const genGuard = condition => `if(${condition})return null;`

const modifierCode: { [key: string]: string } = {
  stop: '$event.stopPropagation();',
  prevent: '$event.preventDefault();',
  self: genGuard(`$event.target !== $event.currentTarget`),
  ctrl: genGuard(`!$event.ctrlKey`),
  shift: genGuard(`!$event.shiftKey`),
  alt: genGuard(`!$event.altKey`),
  meta: genGuard(`!$event.metaKey`),
  left: genGuard(`'button' in $event && $event.button !== 0`),
  middle: genGuard(`'button' in $event && $event.button !== 1`),
  right: genGuard(`'button' in $event && $event.button !== 2`)
}
/*
  作用:
        1、将各个事件的修饰符和属性值处理成函数或数组。
        2、将处理成的函数或数组作为value,将事件名作为key放入对象中,并将字符串形式的对象输出。
*/
export function genHandlers (
  events: ASTElementHandlers,
  isNative: boolean,
  warn: Function
): string {
  // 存在native修饰符? 'nativeOn:{' : 'on:{'
  let res = isNative ? 'nativeOn:{' : 'on:{'
  // 循环events参数中的各个事件
  for (const name in events) {
    res += `"${name}":${genHandler(name, events[name])},`
  }
  return res.slice(0, -1) + '}'
}

// Generate handler code with binding params on Weex
/* istanbul ignore next */
function genWeexHandler (params: Array<any>, handlerCode: string) {
  let innerHandlerCode = handlerCode
  const exps = params.filter(exp => simplePathRE.test(exp) && exp !== '$event')
  const bindings = exps.map(exp => ({ '@binding': exp }))
  const args = exps.map((exp, i) => {
    const key = `$_${i + 1}`
    innerHandlerCode = innerHandlerCode.replace(exp, key)
    return key
  })
  args.push('$event')
  return '{\n' +
    `handler:function(${args.join(',')}){${innerHandlerCode}},\n` +
    `params:${JSON.stringify(bindings)}\n` +
    '}'
}
/*
    作用:
          1、为数组类型时,将数组的各项进行2、3处理之后，将输出的函数有,隔开放入数组中，并将数组输出。
          2、没有修饰符时。如果属性值为函数或函数名时，直接输出属性值;否则将属性值放入函数中并将函数输出。
          3、存在修饰符时。将修饰符处理成函数并&&拼接成字符串放入函数中,将属性值也放入函数中并将函数输出。
*/
function genHandler (
  name: string,
  handler: ASTElementHandler | Array<ASTElementHandler>
): string {
  // 不存在该方法的属性值(发现已在处理事件属性时处理过了,不会发生这种情况)
  if (!handler) {
    return 'function(){}'
  }
  //数组时,将数组中的事件对象信息进行处理过后join(',')成字符串放入数组中,将数组输出
  if (Array.isArray(handler)) {
    return `[${handler.map(handler => genHandler(name, handler)).join(',')}]`
  }
  //const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/
  /*比如: ab['ab']、ab["ab"]、ab[1]、ab[ab]、ab.ab、ab*/
  const isMethodPath = simplePathRE.test(handler.value)
  // const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/
  /*比如: a => 、(a) =>、function (*/
  const isFunctionExpression = fnExpRE.test(handler.value)
  // 没有修饰符
  if (!handler.modifiers) {
    // 满足以上增比如中的一种则返回原表达式
    if (isMethodPath || isFunctionExpression) {
      return handler.value
    }
    /* istanbul ignore if 在weex下*/
    if (__WEEX__ && handler.params) {
      return genWeexHandler(handler.params, handler.value)
    }
    // 返回`function($event){方法属性值表达式}`
    return `function($event){${handler.value}}` // inline statement
    // 有修饰符
  } else {
    let code = ''
    let genModifierCode = ''
    const keys = []
    // 循环修饰符的名字,将修饰符在genModifierCode对象中对应的值拼接成字符串,不存在则放入keys数组中,修饰符名为exact的特殊处理
    for (const key in handler.modifiers) {
      // key名存在vue定义的中时
      if (modifierCode[key]) {
        genModifierCode += modifierCode[key]
        // left/right
        if (keyCodes[key]) {
          keys.push(key)
        }
        // key名为exact(该修饰符用于精确控制只有当那个键被按下时才能被触发,防止多个键按下时也触发)
      } else if (key === 'exact') {
        const modifiers: ASTModifiers = (handler.modifiers: any)
        genModifierCode += genGuard(
          ['ctrl', 'shift', 'alt', 'meta']
            .filter(keyModifier => !modifiers[keyModifier]) //筛选出不存在该方法修饰符中的修饰符
            .map(keyModifier => `$event.${keyModifier}Key`) //将筛选出的修饰符变成`$event.${keyModifier}Key`
            .join('||') //将修改过的筛选修饰符用||拼接成字符串
        )
        //拼接成比如'if($event.ctrlKey || $event.shiftKey || $event.altKey || $event.metaKey)return null;'
      } else {
        //其他的修饰符放入keys数组中
        keys.push(key)
      }
    }
    // left || right || 不存在modifierCode对象中的修饰符名
    if (keys.length) {
      // 将修饰符名处理成函数并&&拼接成字符串输出
      code += genKeyFilter(keys)
    }
    // Make sure modifiers like prevent and stop get executed after key filtering
    // 确保在键过滤后执行像prevent和stop这样的修饰符
    if (genModifierCode) {
      code += genModifierCode
    }
    const handlerCode = isMethodPath // 方法值为methods属性? `return ${handler.value}($event)`
      ? `return ${handler.value}($event)`
      : isFunctionExpression // 方法值为函数表达式? `return (${handler.value})($event)` : handler.value
        ? `return (${handler.value})($event)`
        : handler.value
    /* istanbul ignore if 非WEEX忽略*/
    if (__WEEX__ && handler.params) {
      return genWeexHandler(handler.params, code + handlerCode)
    }
    //输出函数表达式
    return `function($event){${code}${handlerCode}}`
  }
}
/*
  作用: 将keys数组中的修饰符变成函数表达式,并将其用&&拼接,
        输出比如: if(!('button' in $event)&& _k($event.keyCode, 'enter', 'Enter', $event.key, undefined))return null;
*/
function genKeyFilter (keys: Array<string>): string {
  return `if(!('button' in $event)&&${keys.map(genFilterCode).join('&&')})return null;`
}
/*
    作用:
          1、当修饰符名起始字符为数字时,将数字部分转化为十进制并缓存，然后输出比如:$event.keyCode!== 13
          2、当修饰符名起始字符不为数字时,找到keyCodes对象和keyNames对象中对应的值,
             然后输出比如: _k($event.keyCode, 'enter', 'Enter', $event.key, undefined)
*/
function genFilterCode (key: string): string {
  // 将起始字符为数字的修饰符转化成十进制，不为则返回NaN
  const keyVal = parseInt(key, 10)
  // 可以转化成数字时
  if (keyVal) {
    return `$event.keyCode!==${keyVal}`
  }
  // 缓存修饰符名在keyCodes对象中的值
  const keyCode = keyCodes[key]
  // 缓存修饰符名在keyNames对象中的值
  const keyName = keyNames[key]
  // 返回比如: _k($event.keyCode, 'enter', 'Enter', $event.key, undefined)
  return (
    `_k($event.keyCode,` +
    `${JSON.stringify(key)},` +
    `${JSON.stringify(keyCode)},` +
    `$event.key,` +
    `${JSON.stringify(keyName)}` +
    `)`
  )
}
