//基类 调度
class Vue{
    constructor(option){
        this.$el = option.el;
        this.$data = option.data;
        // 计算属性
        this.computed = option.computed;
        // 方法
        this.methods = option.methods;
        // 如果存在根元素
        if(this.$el){
            // 1.将data中数改成Object.defineProperty绑定的形式
            new Observer(this.$data);
            //计算属性
            // this.computed是一个对象，里面存的是一个个方法
            for(let key in this.computed){
                Object.defineProperty(this.$data,key,{
                    get:()=>{
                        // 方法进行调用
                        return this.computed[key].call(this)
                    }
                })
            }
            //处理事件
            for(let key in this.methods){
                Object.defineProperty(this,key,{
                    get:()=>{
                        return this.methods[key]
                    }
                })
            }
            //将vm上的取值操作，都代理到vm.$data上
            // 也就是之前的vm.$data.num取值，改成了vm.num
            this.proxyVm(this.$data)

            // 2.编译模板和数据
            // 将当前的模板和数据进行传递
            new Compiler(this.$el,this)
            
        }
        
    }
    proxyVm(data){
        for(let key in data){
            Object.defineProperty(this,key,{
                get(){
                    return data[key]
                } 
            })
        }
        
    }
}
// 存放观察者
// 数据变化，通知观察者更新
class Dep{
    constructor(){
        this.subs = []; //存放所有的观察者
    }
    // 订阅
    addSub(watcher){
        this.subs.push(watcher)
    }
    depend(){
        if(window.target){
            this.addSub(window.target)
        }
    }
    // 发布
    notify(){
        // 调用所有的观察者进行更新
        this.subs.forEach(watcher=>{
            watcher.updater()
        })
    }
    

}

// 创建一个观察者（发布订阅）
class Watcher{
    // vm当前的实例，value是通过school.name或者num绑定的键，cb是新值更新后的回调函数
    constructor(vm,value,cb){
        this.vm = vm;
        this.value = value;
        this.cb = cb;
        //获取一个初始值
        this.oldValue = this.get()
    }
    get(){
        window.target = this; //把自己放到全局中
        // debugger;
        //当获取值得时候，会触发当前这个这个值得Object.defineProperty.get()方法
        let oldValue = compilerUtil.getVal(this.vm,this.value)
        window.target = null;
        // console.log(oldValue)
        return oldValue;
    }
    // 当数据变化时，进行更新,触发观察者的updater方法
    updater(){
        //获取更新的值
        let newValue = compilerUtil.getVal(this.vm,this.value)
        //如果新值和老值不一致
        if(newValue !== this.oldValue ){
            // 触发回调函数
            this.cb(newValue)
        }
    }
}


// 将data中的数据改成Object.defineProperty绑定的形式
// 实现数据劫持
class Observer{
    constructor(data){
        this.dep = new Dep() //给对象中的每一个属性添加发布订阅的功能
        // def(data,'__ob__',this)
        this.observer(data)
    }
    observer(data){
        // 对数组进行劫持
        let oldProtoMehtods = Array.prototype;
        let proto = Object.create(oldProtoMehtods)
        let methodsToPatch = ['push',
        'pop',
        'shift',
        'unshift',
        'splice',
        'sort',
        'reverse']
        methodsToPatch.forEach(methods=>{
            Object.defineProperty(proto,methods,{
                get(){
                    this.dep.notify()
                    oldProtoMehtods[method].call(this,...arguments)
                }
            })
        })
        // 如果是数组
        if(Array.isArray(data)){
            Object.setPrototypeOf(data,proto);
            // 给数组中的每一项进行observr
            for(let i = 0 ; i < data.length;i++){
                this.observer(data[i])
            }
            return;
        }
        this.walk(data)
        
    }
    walk(data){
        //如果是对象才去添加Object.defineProperty
        if(data && typeof data === 'object'){
            for(let key in data){
                this.defineReactive(data,key,data[key])
            }
        }
    }
    // 给对象改造成Object.defineProperty的形式
    defineReactive(obj,key,val){
        // 如果val还是个对象的话，需要进行递归
        this.observer(val)
        let dep = new Dep() //给对象中的每一个属性添加发布订阅的功能
        Object.defineProperty(obj,key,{
            get:()=>{
                // 每一个数据有对象的数组，数组中存放的他对象的watch 
                // shool:[watcher,watcher]   num:[watcher]
                window.target && this.dep.depend()
                return val
            },
            set:(newVal)=>{
                // 当新值与老值不同时
                if(val != newVal){
                    // 如果新值是一个对象的话,再去给新值添加Object.defineProperty
                    this.observer(newVal)
                    //重新赋值
                    val = newVal
                    // 当对象更新时，触发dep身上的notify,也就是将当前对象的所有watch观察者进行更新
                    this.dep.notify()
                }
                
            }
        })
    }
}
// 编译模板，和数据相结合
class Compiler{
    constructor(el,vm){
        // 1.1判断当前是是元素还是获取
        // 如果不是元素，就获取
        // 获取到了根元素
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        // console.log(this.el)
        // 1.2将根元素下所有元素放到内存中
        let fragment = this.node2fragment(this.el)
        // 1.3将内存中存放的元素与数据相结合
        this.compiler(fragment)
        // console.log(fragment)
        //1.4将内存中元素再放回到根节点中
        this.el.appendChild(fragment)
    }
    //将内存中的dom和数据相结合
    compiler(fragment){
        // console.log(fragment)
        // 1.3.1获取子元素，获取的是一个伪数组
        let childNodes = fragment.childNodes;
        // 将伪数组转成数组
        // childNodes = this.setArr(childNodes)
        // 1.3.2循环子元素
        [...childNodes].map(item=>{
            // 1.3.3判断是否是元素节点还是文本节点
            if(this.isElementNode(item)){
                // 1.3.4是元素节点
                this.compilerElement(item)
                // 如果子元素是元素，进行递归
                this.compiler(item)
            }else{
                // 文本节点
                // 1.3.5是文本节点
                this.compilerText(item)
            }
        })
    }

    // 编译元素节点
    compilerElement(node){
        //判断元素节点属性是否已v-开头
        // 获取元素属性，得到一个伪数组
        // 1.3.4.1
        let attributes = node.attributes;
        // attributes = this.setArr(attributes)
        [...attributes].map(arrts=>{
            // 得到 type='text' v-model='shool.name'
            // 解构得到键也就是type，v-model
            let {name,value} = arrts;
            // 判断键是否包含v-，也就是是不是指令
            // 带有指令的元素
            if(this.isDirective(name)){
                // 拿到v-后面带的指令 v-html v-text v-model
                // v-on:click='change'
                let [,directive] = name.split('-')
                let [directiveName,eventName] = directive.split(':')
                // console.log(directive)
                // 再去调用相对应的方法
                // 传入当前元素node,指令后面的值value，vm数据
                compilerUtil[directiveName](node,value,this.vm,eventName)
                // console.log(node,'element')
            }
        })
        
    }

    // 编译文本节点
    compilerText(node){
        // 获取文本
        let content = node.textContent;
        // 只需要带有{{}}的文本
        if(/\{\{(.+?)\}\}/.test(content)){
            // console.log(content,'text') //找到所有{{}}的文本
            compilerUtil['text'](node,content,this.vm)
        }
    }
    // 判断是否是指令
    isDirective(attrName){
        return attrName.includes('v-')
    }
    // 将根元素中的所有节点添加到内存中
    node2fragment(el){
        // 新建一个文档碎片
        let fragment = document.createDocumentFragment();
        let firstChild = ''
        // 当appendChild添加完毕，页面中没有任何元素时，就会跳出循环
        while(firstChild = el.firstChild){
            // appendChild()会将页面中的元素删除并添加到fragment中
            fragment.appendChild(firstChild)
        }
        return fragment;
    }
    // 判断当前是否是元素
    isElementNode(node){
        // 获取的是元素
        return node.nodeType === 1
    }

    // 将伪数组转成数组
    setArr(arr){
        return Array.prototype.slice.call(arr)
    }
}
compilerUtil = {
    // 处理实例中的文本框绑定的值
    // shool.name
    getVal(vm,expr){
        // 获取vm实例data中的数据
        // [shool,name]
        return expr.split('.').reduce((data,current)=>{
            return data[current]
        },vm.$data)
    },
    // 给文本框设置值 school.name 需要给当前对象的最后name赋值
    setVal(vm,expr,newVal){
        expr.split('.').reduce((data,current,index,arr)=>{
            if(index === arr.length - 1){
                data[current] = newVal;
            }
            return data[current]
        },vm.$data)
    },
    // 处理事件
    on(node,expr,vm,eventName){
        node.addEventListener(eventName,(e)=>{
            vm[expr].call(vm,e)
        })
    },
    // node是当前元素节点，value是指令后面的值比如 v-model='shool.name'中的shool.name，
    // vm是实例
    model(node,value,vm){
        // console.log(node,value,vm)
        let fn = this.updater['modelUpdater'];
        // 添加一个观察者wather,输入内容的时候需要被监控
        // 如果输入框更新,需要重新赋值
        new Watcher(vm,value,(newVal)=>{
            // 数据更新，重新赋值
            fn(node,newVal)
        })
        // 给文本框添加input事件
        node.addEventListener('input',(e)=>{
            let newVal = e.target.value;
            this.setVal(vm,value,newVal)
        })
        // 从实例中拿到文本框的数据
        let val = this.getVal(vm,value)
        fn(node,val)

    },
    // 便利所有表达式，将{{a}} {{b}}统一获取他们的值
    getContentValue(vm,content){
        return content.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            return this.getVal(vm,args[1])
        })
    },
    // node是当前文本，content是{{school.name}} {{name}}这些
    // vm是当前的实例
    text(node,content,vm){
        let fn = this.updater['textUpdater']
        // 拿到实例中绑定的数据，比如num绑定的是10
        let cont = content.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            //console.log(args[1]) //shool.name  num
            // 添加一个观察者，给{{}}
            new Watcher(vm,args[1],()=>{
                fn(node,this.getContentValue(vm,content))
            })
            return this.getVal(vm,args[1])
        })
        // 给当前文本进行赋值
        fn(node,cont)
    },
    html(){

    },
    updater:{
        // 设置input框的vaule
        modelUpdater(node,value){
            // 给当前的输入框赋值
            node.value = value;
        },
        // 设置文本节点
        textUpdater(node,value){
            node.textContent = value;
        }
    }
}