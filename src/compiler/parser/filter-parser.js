/* @flow */

const validDivisionCharRE = /[\w).+\-_$\]]/

/*
  作用:
        1、解析过滤器的函数
        2、将过滤器从表达式中分解出来
        3、将过滤器和属性值通过wrapFilter函数拼接成_f函数并输出该函数
        4、没有过滤器时将表达式直接输出
*/
export function parseFilters (exp: string): string {
  let inSingle = false
  let inDouble = false
  let inTemplateString = false
  let inRegex = false
  let curly = 0
  let square = 0
  let paren = 0
  let lastFilterIndex = 0
  let c, prev, i, expression, filters

  for (i = 0; i < exp.length; i++) {
    //缓存上一个字符的Unicode 编码
    prev = c
    //获取exp字符串指定位置的字符的 Unicode 编码(十进制)
    c = exp.charCodeAt(i)
    //inSingle为true(表示''里面的字符)
    if (inSingle) {
      //当前字符Unicode编码为十六进制的'时 && 上一个字符不为\时  inSingle为false
      if (c === 0x27 && prev !== 0x5C) inSingle = false
      //inSingle = false && inDouble = true(表示""里面的字符)
    } else if (inDouble) {
      //当前字符Unicode编码为十六进制的""时 && 上一个字符不为\时  inDouble为false
      if (c === 0x22 && prev !== 0x5C) inDouble = false
      //inSingle = false && inDouble = false && inTemplateString = true(表示``里面的字符)
    } else if (inTemplateString) {
      //当前字符Unicode编码为十六进制的`时 && 上一个字符不为\时  inTemplateString为false
      if (c === 0x60 && prev !== 0x5C) inTemplateString = false
      //inSingle = false && inDouble = false && inTemplateString = false && inRegex = false(表示正则里面的字符)
    } else if (inRegex) {
      //当前字符Unicode编码为十六进制的/时 && 上一个字符不为\时  inRegex为false
      if (c === 0x2f && prev !== 0x5C) inRegex = false
      //上面的条件都为false && 当前字符Unicode编码为十六进制的|时 && 上一个字符不为| && 下一个字符不为|
      // && 字符不在{}中 && 字符不在[]中 && 字符不在()中 时(表示非短路|运算符)
    } else if (
      c === 0x7C && // pipe
      exp.charCodeAt(i + 1) !== 0x7C &&
      exp.charCodeAt(i - 1) !== 0x7C &&
      !curly && !square && !paren
    ) {
      // expression 未赋值过
      if (expression === undefined) {
        // first filter, end of expression
        // 获取当前字符的下一个字符下标
        lastFilterIndex = i + 1
        // 获取当前字符位置的前面所有字符串并去除前后空格
        expression = exp.slice(0, i).trim()
      } else {
        // 截取lastFilterIndex 到 i下标的字符放入filters数组中，并将lastFilterIndex下标更新到 i + 1
        pushFilter()
      }
    //以上条件都不满足时(表示除|以及下面这些字符的普通字符)
    } else {
      switch (c) {
        case 0x22: inDouble = true; break         // "
        case 0x27: inSingle = true; break         // '
        case 0x60: inTemplateString = true; break // `
        case 0x28: paren++; break                 // (
        case 0x29: paren--; break                 // )
        case 0x5B: square++; break                // [
        case 0x5D: square--; break                // ]
        case 0x7B: curly++; break                 // {
        case 0x7D: curly--; break                 // }
      }
      // 当前字符为/时
      if (c === 0x2f) { // /
        //缓存上一个字符的下标
        let j = i - 1
        let p
        // find first non-whitespace prev char
        //该循环的作用: 获取该/字符前面不为空格的字符退出循环 或  一直不满足条件知道循环结束时p = 空格字符
        for (; j >= 0; j--) {
          //获取exp字符串中j下标位置的字符
          p = exp.charAt(j)
          //不为空格时，退出循环
          if (p !== ' ') break
        }
        //  方便理解: const validDivisionCharRE = /[\w).+\-_$\]]/
        //当前p为空格时 || (p不为 \w(包括下划线的任何单词字符)或者)|| . || + || - || _ || $ || ])时,
        //将inRegex设为true  表示接下来的字符是正则表达式
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }
  //不存在非短路|运算符时,缓存属性值字符串
  if (expression === undefined) {
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    //截取非短路|运算符后面的字符串放入filters数组
    pushFilter()
  }

  /*
    作用: 截取lastFilterIndex 到 i下标的字符放入filters数组中，并将lastFilterIndex下标更新到 i + 1
  */
  function pushFilter () {
    //将截取的字符串放入filters数组中
    (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    //将下标赋值为当前字符的下一个字符下标
    lastFilterIndex = i + 1
  }

  //循环filters数组
  if (filters) {
    for (i = 0; i < filters.length; i++) {
      expression = wrapFilter(expression, filters[i])
    }
  }
  //输出属性值表达式
  return expression
}

/*
    作用:
          1、解析过滤器
          2、将过滤器和属性值变成_f("filter")(exp)或者_f("filter")(exp, filter方法中的参数)
*/
function wrapFilter (exp: string, filter: string): string {
  //判断是否有(字符
  const i = filter.indexOf('(')
  //不存在
  if (i < 0) {
    // _f: resolveFilter
    return `_f("${filter}")(${exp})`
  } else {
    //获取过滤器(字符前面的字符串
    const name = filter.slice(0, i)
    //获取过滤器(字符后面的字符串
    const args = filter.slice(i + 1)
    //比如add(1)会变成   `_f("add")(${exp},1)`
    return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
  }
}
