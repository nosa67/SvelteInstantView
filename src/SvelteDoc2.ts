import {JSDOM}  from 'jsdom';
import * as UTILITY from './utility';

// HTMLタグの属性で値を持たず設定されるだけで有効になる属性名の配列
const dropIfFalseAttrs = ['checked', 'required','autofocus','multiple','novalidate','hidden',
        'draggable', 'scoped','async', 'defer', 'disabled','readonly','reversed','ismap','loop'];

//================================================================================
//  Svelteのドキュメント（ファイルの情報）
//================================================================================
export class SvelteDoc2{

    //================================================================================
    //  プロパティ
    //================================================================================
    public filename = "";                                   // ファイル名（スコープcss名で利用）
    public scriptsText = "";                                // scriptのタグ内のテキスト
    public styleText = "";                                  // styleタグ内をスコープ内に変更したテキスト
    public dom:JSDOM| null = null;                          // html部分のDOM
    public sveltePraceFolder:{[key:string]:string} = {};    // svelteプレースフォルダ情報
    public children:{[key:string]:SvelteDoc2} = {};         // インポートしているコンテンツリスト

    //================================================================================
    //  公開メソッド
    //================================================================================
 
    // テキストファイルを読み込んでタグリストを作成する
    // [引数]   filepath    読み込むファイルパス
    public readFile(filepath:string){

        // ファイル名の設定
        const path = require('path');
        this.filename = path.basename(filepath).replace(".svele", "");

        // ファイルの読み込み
        const fs = require('fs');
        var fileText = fs.readFileSync(filepath, 'utf8');
        
        // htmlのコメントを削除する
        fileText = this.dropComment(fileText);

        // SvelteファイルをHTML部分、スクリプト部分、Style部分に分割する
        this.splitSvelteParts(fileText);

        // 配下のコンポーネントを読み込む
        this.getCompornents(path.dirname(filepath));

    }

    // スコープ化したCSSテキストの取得
    public getCss():string{
        let resultCss = this.styleText;
        for(let child in this.children){
            resultCss += this.children[child].getCss();
        }
        return resultCss;
    }

    // html文字列の取得
    // 呼出元のタグに設定されている属性リスト。（おおもとの場合は空オブジェクト）
    public getHtml(tagAttributes:{[key:string]:string}):string{

        // ファイル内のスクリプトに設定されている変数とエリアスを反映させる
        this.setScriptParams(tagAttributes);

        // 変数を設定するjavascriptを作成
        let evalScriptBase ="(function(){";
        for(let setAttr in tagAttributes){
            evalScriptBase += "let " + setAttr + "='" + tagAttributes[setAttr] + "'\n";
        }

        // 上の変数設定にreturn  (svelteのプレースフォルダの内容) をevalした結果を置換リストに設定
        let replaceValues:{key:string,value:string}[] = [];
        for(let key in this.sveltePraceFolder){
            const evalScript = evalScriptBase + "return " + this.sveltePraceFolder[key] + "})()";
            let evalValue = "";
            try{
                evalValue = eval(evalScript);
            }catch{
            }
            if (evalValue && typeof evalValue === 'function') {
                replaceValues.push({key:key, value:''});
            }else{
                replaceValues.push({key:key, value:evalValue});
            }
        }

        // 子コンポーネントのhtmlを取得して置き換える
        if(this.dom !== null){

            let tmphtml = this.dom.window.document.body.innerHTML;
            for(let changeItem of replaceValues){
                let exp = new RegExp(changeItem.key, 'g');
                tmphtml = tmphtml.replace(exp, changeItem.value);
            }
            this.dom.window.document.body.innerHTML = tmphtml;

            this.replaceNotValuedAttrs(this.dom.window.document.body);

            for(let compName in this.children){
                let childCompornent = this.children[compName];
                let targetElements = this.dom.window.document.getElementsByTagName(compName);
                for(let index =0; index < targetElements.length; index ++){
                    let childTagAttributes:{[key:string]:string} = {};
                    for(let attrName of targetElements[index].getAttributeNames()){
                        let attrVal = targetElements[index].getAttribute(attrName);
                        if(attrVal !== null){
                            if(attrName.indexOf(':') >= 0){
                                attrName = attrName.substr(attrName.indexOf(':') + 1);
                            }
                            if(attrVal.trim().length >0){
                                childTagAttributes[attrName] = attrVal;
                            }else{
                                childTagAttributes[attrName] = '';
                            }
                        }
                    }
                    targetElements[index].outerHTML = childCompornent.getHtml(childTagAttributes);
                }
            }

            return this.dom.window.document.body.innerHTML;
        }
        return "";
    }

    //================================================================================
    //  内部処理
    //================================================================================
    
    // htmlのコメント<!--   ->を削除する
    // [引数]   svelteファイル内の全テキスト
    // [返値]   コメントを削除したテキスト
    private dropComment(text:string):string{
        let startIndex = text.lastIndexOf('<!--');
        while(startIndex >= 0){
            let endIndex = text.indexOf('-->', startIndex + 3);
            if(endIndex < 0){
                text = text.substr(0,startIndex);
            }
            else{
                text = text.substr(0,startIndex) + text.substr(endIndex + 3);
            }
            startIndex = text.lastIndexOf('<!--');
        }

        return text;
    }
            
    // 値を持たないタグ属性（設定するだけで効果があるタグ属性）がfalseなら、その属性を削除する
    // エレメント内のタグ属性を処理して、再帰的に子エレメントも処理することですべて処理する
    private replaceNotValuedAttrs(baseElement:Element) {
        // エレメントの属性名リストを取得
        let attrNames = baseElement.getAttributeNames();

        // 全ての属性を処理
        for(let attrName of attrNames){

            // 値を持たない属性リスト（このファイルの先頭で定数として既定）かどうか判定
            if(dropIfFalseAttrs.includes(attrName)){

                // 値を持たない属性にfalseが設定されている場合はその属性を削除する
                let attrVal = baseElement.getAttribute(attrName);
                if(attrVal !== null){
                    attrVal = attrVal.trim().toLowerCase();
                    if((attrVal === '') || (attrVal === 'false')){
                        baseElement.removeAttribute(attrName);
                    }
                }
            }
        }

        // 子のエレメントの子エレメントを再帰的に処理する
        for(let index=0; index < baseElement.children.length; index ++ ){
            let child = baseElement.children[index];
            this.replaceNotValuedAttrs( child);
        }
        
    }

    // SvelteファイルをHTML部分、スクリプト部分、Style部分に分割する
    // [引数]   text    svelteファイル内の全テキストからコメントを削除した物
    // [備考]   以下の内容が設定される
    //              this.scriptsText    全てのスクリプトが設定される
    //              this.dom            svelteファイル内のscriptタグとstyleタグを除く部分のHTML(svelteのプレースフォルダはユニーク文字で置換されている
    private splitSvelteParts(text:string){

        // スクリプトテキストの取得
        let scriptTagBlocks = UTILITY.getTagBlocks(text, 'script');
        for(let scriptTagRange of scriptTagBlocks){
            this.scriptsText += text.substr(scriptTagRange.innerStart, scriptTagRange.innerEnd - scriptTagRange.innerStart + 1) + '\r\n';
        }
        
        // スクリプトテキストを削除
        for(let index = scriptTagBlocks.length -1; index >= 0; index -- ){
            text = text.substr(0,scriptTagBlocks[index].outerStart) + text.substr(scriptTagBlocks[index].outerEnd + 1); 
        }

        let styleText = "";     // styleのテキストを一時格納する変数

        // styleテキストの取得
        let styleTagBlocks = UTILITY.getTagBlocks(text, 'style');
        for(let styleTagRange of styleTagBlocks){
            let dom = new JSDOM(text.substr(styleTagRange.outerStart, styleTagRange.outerEnd + 1));
            let styleTag = dom.window.document.getElementsByTagName('style')[0];
            let styleLang = styleTag.getAttribute('lang');
            if(styleLang === null){
                styleText += styleTag.innerHTML;
            }else{
                styleText += UTILITY.convertSass(styleTag.innerHTML, styleLang) + '\r\n';
            }
        }
        
        // styleを削除
        for(let index = styleTagBlocks.length -1; index >= 0; index -- ){
            text = text.substr(0,styleTagBlocks[index].outerStart) + text.substr(styleTagBlocks[index].outerEnd + 1);
        }
 
        // svelteの{#if}でelse以下を削除する
        text = this.dropSvelteIfElse(text);

        // プレースフォルダの置換名を作成するための内部メソッド
        function createSveltePracefolderName(text:string,index:number){
            let replaceText = "svelte_pracefolder_" + ('0000000' + index.toString()).slice(-7);
            let replaceAddIndex = 0;
            while(text.includes(replaceText)){
                replaceText += "a";
            }
            return replaceText;
        }

        // 残りがHTMLになるので、Svelteのプレースフォルダを置き換える（こうしないとDOMとして正常に読めない）
        let praceFolderIndex = text.indexOf('{',0);
        while(praceFolderIndex >= 0){
            let pracefolderEnd = UTILITY.getPlacefolderEnd(text, praceFolderIndex);
            if(pracefolderEnd >= 0){
                let svelteText = text.substr(praceFolderIndex + 1, pracefolderEnd - praceFolderIndex - 1).trim();
                if(svelteText.length > 0){
                    let replaceName = createSveltePracefolderName(text, praceFolderIndex);
                    this.sveltePraceFolder[replaceName] = svelteText;
                    text = text.substr(0,praceFolderIndex) + replaceName + text.substr(pracefolderEnd + 1);
                }else{
                    text = text.substr(0,praceFolderIndex) + text.substr(pracefolderEnd + 1);
                }
            }else{
                throw new Error('not exist placefolder End started by ' + praceFolderIndex.toString() + ' in file ' + this.filename + '.');
            }
            praceFolderIndex = text.indexOf('{',praceFolderIndex);
        }

        // htmlをDOMに設定
        this.dom = new JSDOM(text);

        // style内のcssを独自CSSに変換する
        this.convertCss(styleText);
    }

    private getIfEnd(text:string, startIndex:number):number{
        let lastIndex = startIndex - 1;
        
        let counter = 1;
        while(counter > 0){
            let findInfo = UTILITY.multiIndexOf(text, lastIndex + 1, ['{','}']);
            if(findInfo.index < 0){
                return text.length - 1;
            }
            lastIndex = findInfo.index;
            if(findInfo.findstr === '{'){
                counter ++;
            }else{
                counter --;
            }
        }
        return lastIndex;
    }


    // svelteの{#if}でelse以下を削除する
    // [引数]   text    svelteのhtmlテキスト
    // [返値]   svelteの{#if}で{:else以下を削除したテキスト
    private dropSvelteIfElse(text:string):string{
    
        let isStartIndex = text.indexOf('{#if');
        
        while(isStartIndex >= 0){

            // {#if}の終了位置を取得を取得し、存在するならそのブロックを削除(終了位置を)開始位置まで戻す
            let ifEndIndex = this.getIfEnd(text, isStartIndex + 4);
            // let ifEndIndex = text.indexOf('}', isStartIndex + 4);
            if(ifEndIndex >= 0){
                text = text.substr(0,isStartIndex) + text.substr(ifEndIndex + 1);
                ifEndIndex = isStartIndex;
            }

            let counter = 1;
            let findStart = ifEndIndex + 1;
            let deleteStart = -1;

            // {/if}まで処理する。途中{#if}がある場合ネストとみなしてネストがなくなるまで処理する
            while(true){
                let nextInfo = UTILITY.multiIndexOf(text,findStart , ['{#if','{/if', '{:else']);
                if(nextInfo.index < 0){
                    // {#if}の対となるものがなければ終了
                    break;
                }else{
                    if(nextInfo.findstr === '{#if'){
                        // {#if}が見つかったので階層を１加算しブロックの終了位置を次の検索開始位置にする
                        counter ++;
                        findStart = this.getIfEnd(text, nextInfo.index + 4) + 1;
                        // findStart = text.indexOf('}', nextInfo.index + 4) + 1;
                    }else if(nextInfo.findstr === '{/if'){
                        // {/if}が見つかったので階層を１減産
                        counter --;
                        if(counter <= 0){
                            
                            let deleteEnd = this.getIfEnd(text, nextInfo.index + 4);
                            // let deleteEnd = text.indexOf('}', nextInfo.index + 4);
                            if(deleteEnd >= 0){
                                // {/if の後ろの} が見つかった場合
                                if(deleteStart > 0){
                                    // ブロック内で{:elseが有った場合その開始位置から{/if}の最後までを削除
                                    text = text.substr(0,deleteStart) + text.substr(deleteEnd + 1);
                                }else{
                                    // ブロック内に{:elseがなかった場合、{/if}を削除
                                    text = text.substr(0,nextInfo.index) + text.substr(deleteEnd + 1);
                                }
                            }else{
                                // {/if の後ろの} が見つからなかった場合
                                if(deleteStart > 0){
                                    // ブロック内で{:elseが有った場合その開始位置から以降すべて削除
                                    text = text.substr(0,deleteStart);
                                }else{
                                    // ブロック内に{:elseがなかった場合、{/if}から以降すべて削除
                                    text = text.substr(0,nextInfo.index);
                                }
                            }

                            // {/if}が見つかったのでブロック内処理のループを終了して次の{ifを探させる}
                            break;
                        }else{
                            // ブロックの終了まで来ていないので{/if}の後ろまでインデックスを移動
                            findStart = this.getIfEnd(text, nextInfo.index + 4) + 1;
                            // findStart = text.indexOf('}', nextInfo.index + 4) + 1;
                            if(findStart < 0){
                                findStart = nextInfo.index + 4;
                            }
                        }
                    }else{
                        // {:elseが見つかった場合、第１階層で最初の時だけ削除開始位置に設定
                        if((counter === 1) && (deleteStart < 0)){
                            deleteStart = nextInfo.index;
                        }
                        findStart = this.getIfEnd(text, nextInfo.index + 4) + 1;
                        // findStart = text.indexOf('}', nextInfo.index + 4) + 1;
                        if(findStart < 0){
                            findStart = nextInfo.index + 6;
                        }
                    }
                }   
            }

            // 再度{if}ブロックの開始を探す
            isStartIndex = text.indexOf('{#if');
        }
        return text;
    }

    // svelteのファイル内のstyleをユニーク名に変える
    private convertCss(styleText:string){
        
        styleText = styleText.replace('@charset "UTF-8";','');

        let addClassName = this.filename.replace('.svelte','');

        // styleタグ内のテキストから「{」を取得
        let current = 0;
        let startIndex = styleText.indexOf('{');
        while(startIndex >= 0){
            // {までをセレクタとして取得
            let className = styleText.substr(current,startIndex - current).trim().toLowerCase();

            // {}で囲まれた範囲をCSSの設定内容として取得
            let endIndex = styleText.indexOf('}', startIndex);
            var classValue = "";
            if(endIndex < 0){
                classValue = styleText.substr(startIndex);
                current = styleText.length;
            }else{
                classValue = styleText.substr(startIndex, endIndex - startIndex + 1 );
                current = endIndex + 1;
            }
            
            //「.」の存在を確認して、存在する場合はクラス名の前にファイル名_を追加してファイル内のタグのclass名を変更。
            // ない場合は後ろに.ファイル名を追加しファイル内のタグのclassの先頭に追加
            let replaceClassName = "";
            let dotIndex = className.indexOf('.');
            if(dotIndex >= 0){
                replaceClassName = className.substr(0,dotIndex) + '.' + addClassName + '_' + className.substr(dotIndex + 1);
            }else{
                replaceClassName = className.substr(0,dotIndex) + '.' + addClassName;
            }

            // 当オブジェクトのスタイルに追加
            this.styleText += replaceClassName + classValue + '\r\n';

            // セレクタで検索して対象のclassアトリビュートにスコープにしたセレクタを設定する
            if(this.dom !== null){
                this.dom.window.document.querySelectorAll(className).forEach((element) =>{
                    let classAttr = element.getAttribute('class');

                    if(dotIndex >= 0){
                        if(classAttr !== null){
                            let classes = classAttr.toLowerCase().replace(/[ |\t]+/g, ' ').split(/ |\t/);
                            classAttr = "";
                            let classNameOnly = className.trim().substr(className.indexOf('.') + 1);
                            for(let item of classes){
                                if(item === classNameOnly){
                                    classAttr += replaceClassName.substr(replaceClassName.indexOf('.') + 1) + ' ';
                                }else{
                                    classAttr += item + ' ';
                                }
                                element.setAttribute('class', classAttr);
                            }
                        }
                    }else{
                        if(classAttr !== null){
                            element.setAttribute('class',replaceClassName);
                        }
                        else{
                            element.setAttribute('class',replaceClassName + ' ' + element.getAttribute('class'));
                        }
                    }
                });
            }

            startIndex = styleText.indexOf('{', endIndex + 1);
        }
    }

    // 配下のコンポーネントを読み込む
    // 自身のコンポーネントのフォルダパス
    public getCompornents(currentPath:string){

        const path = require('path');

        let startIndex = this.scriptsText.indexOf("import ");
        while(startIndex >= 0){
            let fromStart = this.scriptsText.indexOf("from ", startIndex);
            if(fromStart >= 0){
                let lineEndInfo = UTILITY.multiIndexOf(this.scriptsText, fromStart, [';','\n']);
                if(lineEndInfo.index >= 0){
                    let key = this.scriptsText.substr(startIndex + 7, fromStart - (startIndex + 7));
                    key = key.replace("{","").replace("}","").trim();
                    let importFile = this.scriptsText.substr(fromStart + 5, lineEndInfo.index - (fromStart + 5));
                    importFile = importFile.replace(/\"/g,"").replace(/\'/g,"").trim();
                    if(importFile.substr(importFile.lastIndexOf('.') + 1).toLowerCase() === 'svelte')
                    {
                        let doc = new SvelteDoc2();
                        try{
                            // 読み込めないパッケージは無視する
                            doc.readFile(path.join(currentPath, importFile));
                            this.children[key] = doc;
                        }catch{}
                    }
                    startIndex = lineEndInfo.index;
                }
                else{
                    startIndex = fromStart; 
                }
            }else{
                startIndex = startIndex + 7;
            }
            startIndex = this.scriptsText.indexOf("import ", startIndex);
        }
    }

    // タグに設定されている属性リストにSvelteの変数設定を反映させる
    // [引数]   tagAttributes   タグに設定されている属性リスト
    private setScriptParams(tagAttributes:{[key:string]:string}):void{

        // 複数のスペースとタブを一つのスペースに置き換える
        let text = this.scriptsText.replace(/\s\s+/g, ' ');

        // Svelteで属性名が別の変数にアリアスされている場合は連想配列のキーを変更
        let exportIndex = text.indexOf('export ');
        while(exportIndex > 0){
            let startIndex = exportIndex + 7;
            if(text.substr(startIndex, 1) === '{'){
                let endIndex = text.indexOf('}', startIndex);
                let inText = text.substr(startIndex + 1, endIndex - startIndex - 1).trim();
                let splited = inText.split(' ');
                if((splited.length === 3) && (splited.indexOf('as') === 1)){
                    if(tagAttributes[splited[2]]){
                        tagAttributes[splited[0]] = tagAttributes[splited[2]];
                        delete tagAttributes[splited[2]];
                    }
                }
                }
            exportIndex = text.indexOf('export ', startIndex + 8);
        }

        // Svelteのlet,const,varで定数が設定されている場合はそれを追加設定
        let currentIndex = 0;
        let findInfo = UTILITY.multiIndexOf(text, currentIndex, ['let','const','var']);
        while(findInfo.index > 0){
            let valInfo = this.getValiableInfo(text, findInfo.index + findInfo.findstr.length);
            if(!tagAttributes[valInfo.key.toLowerCase()]){
                tagAttributes[valInfo.key] = valInfo.val;
            }else{
                if(valInfo.key.toLowerCase() !== valInfo.key){
                    let tmpVal = tagAttributes[valInfo.key.toLowerCase()];
                    delete tagAttributes[valInfo.key.toLowerCase()];
                    tagAttributes[valInfo.key] = tmpVal;
                }
            }
            currentIndex = valInfo.index;
            findInfo = UTILITY.multiIndexOf(text, currentIndex, ['let','const','var']);
        }
    }

    // Svelteの変数の内容を取得する
    // [引数]   text        スクリプト
    //          startIndex  変数の開始位置（変数名の開始位置）
    // [返値]   key     変数名
    //          val     変数の値
    //          index   変数の終了位置の次の文字の位置
    private getValiableInfo(text:string, startIndex:number):{key:string,val:string, index:number}{
        
        // まず変数名を取得する
        let index = startIndex;
        let valName = "";
        while(index < text.length){
            let chr1 = text.substr(index,1);
            if(chr1 ===':'){
                // 型定義がある場、そこまでを変数名とし次の「=」を探す
                valName = text.substr(startIndex,index - startIndex).trim();
                let info = UTILITY.multiIndexOf(text, index, ['=', ' ']);
                if(info.findstr === ' '){
                    if(text.substr(info.index + 1,1) === '='){
                        // 変数名の後、スペースが来て次が「=」なのでそれ以降が変数の値の開始位置
                        index = info.index + 2;
                        break;
                    }else{
                        // 変数名の後、スペースが来て次が「=」でない場合は変数の値が未設定なので空文字列の設定を追加して終了
                        return {key:valName, val:"", index:(info.index + 1)};
                    }
                }else{
                    // 変数の後ろがすぐ「=」ならそれ以降が変数の値の開始位置
                    index = info.index + 1;
                    break;
                }
                
            }else if(chr1 === '='){
                // 型定義が無く「=」になった場合そこまでが変数名でそれ以降が変数の値の開始位置
                valName = text.substr(startIndex,index - startIndex).trim();
                index ++;
                break;
            }

            index ++;
        }

        // 変数の値の開始位置がスペースの場合次の文字を開始位置にする
        if(text.substr(index,1) === ' '){
            index ++;
        }

        if(text.substr(index,1) === '"'){
            // 「"」で開始しているので次の「"」までを変数の値として結果を返す
            let valEnd = text.indexOf('"', index + 1);
            return {key:valName, val:text.substr(index + 1,valEnd - index - 1 ), index:(valEnd + 1)};
        }else if (text.substr(index,1) === "'"){
            // 「'」で開始しているので次の「'」までを変数の値として結果を返す
            let valEnd = text.indexOf("'", index + 1);
            return {key:valName, val:text.substr(index + 1,valEnd - index - 1 ), index:(valEnd + 1)};
        }else{
            let endInfo = UTILITY.multiIndexOf(text, index, [' ', '\t', '(', '{', ';']);
            if((endInfo.findstr !== '(') && (endInfo.findstr !== '{')){
                let evalVal = "";
                try{
                    evalVal = eval(text.substr(index, endInfo.index - index));
                }catch{
                }
                return {key:valName, val:evalVal, index:(index + 1)};
            }else{
                return {key:valName, val:"", index:(index + 1)};
            }
        }
    }
}