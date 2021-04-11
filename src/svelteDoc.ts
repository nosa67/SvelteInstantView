//================================================================================
//  定数
//================================================================================
// 終了タブが不要なタグ名
const singleTags = [
    'br','img','hr','meta','input','embed','area','base','col','keygen','link','param','source'
];

// Svelteの制御処理判定文字列
const svelteControlMarks = ['#',':','/'];

import {multiIndexOf, getPlacefolderEnd, getTagEnd, passSpaceAndTab, getAttrValue} from './utility';

//================================================================================
//  基本インタフェース
//================================================================================
interface SveltePart{

    // HTMLを返す
    getHtml(variables:{[key:string]:string}, compornents:{ [key: string] :SvelteDoc}):string;
}

//================================================================================
//  コンテンツの文字情報ブロック
//================================================================================
class SvelteText implements SveltePart{

    // 文字列情報
    public text = "";

    // コンストラクタ
    // [引数]   内部の文字列
    constructor(text:string) {
        this.text = text;
    }

    // html文字列の取得
    public getHtml(variables:{[key:string]:string},compornents:{ [key: string] :SvelteDoc}):string{

        let evalScriptBase ="(function(){";
        for(let setAttr in variables){
            evalScriptBase += "let " + setAttr + "='" + variables[setAttr] + "'\n";
        }

        let current = 0;
        let resultText = "";
        let startIndex = this.text.indexOf('{');
        while(startIndex >= 0){
            let endIndex = getPlacefolderEnd(this.text, startIndex);
            if(endIndex >= 0){
                let name = this.text.substr(startIndex + 1,endIndex - startIndex - 1);
                const evalScript = evalScriptBase + "return " + name + "})()";
                let evalValue = "";
                try{
                    evalValue = eval(evalScript);
                }catch{
                }
                resultText = this.text.substr(current, startIndex - current) + evalValue;
                current = endIndex + 1;
            }else{
                break;
            }
            startIndex = this.text.indexOf('{', current);
        }

        if(current < this.text.length){
            resultText += this.text.substr(current);
        }

        return resultText;
    }
}

//================================================================================
//  コンテンツのタグブロック
//================================================================================
class SvelteTag implements SveltePart{

    // プロパティ
    public tagName = "";                                            // タグ名
    public attributes:{[index: string]: string} = {};    // 属性の連想配列
    public contents:SveltePart[] = [];                              // 内部のコンテンツリスト
    public placeFolderAttributes:{[index: string]: string} = {};    // プレースフォルダとなっている属性の連想配列

    // コンストラクタ
    // [引数]   tagName     タグ名
    //          tagText     タグの属性部分の文字列
    constructor(tagName:string, tagText:string){

        // タグ名を設定(念の為scriptとstyleは小文字化しておく)
        this.tagName = tagName;
        if(this.tagName.toLowerCase() === 'script'){
            this.tagName = 'script';
        } 
        if(this.tagName.toLowerCase() === 'style'){
            this.tagName = 'style';
        }

        // タグの属性の連想配列を設定
        this.createAttributes(tagText);
    }

    public getChangedAttributes(variables:{[key:string]:string}):{[key:string]:string}{
        let result:{[key:string]:string} = {};
        
        // 固定の属性データをコピー
        for(let attr in this.attributes){
            result[attr] = this.attributes[attr];
        }

        // 引数の全ての変数とその内容をletのjavascript文字列にする
        let evalScriptBase ="(function(){";
        for(let setAttr in variables){
            evalScriptBase += "let " + setAttr + "='" + variables[setAttr] + "'\n";
        }
    
        // プレースフォルダの属性情報を変更してコピー
        for(let attr in this.placeFolderAttributes){

            if(attr.substr(0,2) !== 'on'){
                const evalScript = evalScriptBase + "return " + this.placeFolderAttributes[attr].substr(1,this.placeFolderAttributes[attr].length -2) + "})()";
                let evalValue = "";
                try{
                    evalValue = eval(evalScript).toString();
                }catch{
                }

                result[attr] = evalValue;
            }
        }

        return result;
    }

    // html文字列の取得
    public getHtml(variables:{[key:string]:string}, compornents:{ [key: string] :SvelteDoc}):string{
        
        // タグの開始部分を作成
        let result = "<" + this.tagName;
        
        // 固定の属性データを設定
        for(let attr in this.attributes){
            if(this.attributes[attr].indexOf('"') >= 0){
                result += " " + attr + "='" + this.attributes[attr] + "'";
            }else{
                result += " " + attr + '="' + this.attributes[attr] + '"';
            }
        }

        // 引数の全ての変数とその内容をletのjavascript文字列にする
        let evalScriptBase ="(function(){";
        for(let setAttr in variables){
            evalScriptBase += "let " + setAttr + "='" + variables[setAttr] + "'\n";
        }
    
        // プレースフォルダの属性情報を作成
        for(let attr in this.placeFolderAttributes){

            if(attr.substr(0,2) !== 'on'){
                let replacedText = "";
                let text = this.placeFolderAttributes[attr];
                let current = 0;
                let startIndex = text.indexOf('{');
                while(startIndex >= 0){
                    if(current < startIndex){
                        replacedText += text.substr(current,startIndex- current);
                    }
                    let endIndex = getPlacefolderEnd(text, startIndex);
                    if(endIndex < 0){
                        endIndex = text.length;
                    }
                    current = endIndex + 1;
                    const evalScript = evalScriptBase + "return " + text.substr(startIndex + 1, endIndex - startIndex - 1) + "})()";
                    try{
                        replacedText += eval(evalScript).toString();
                    }catch{
                    }
                    startIndex = text.indexOf('{', endIndex);
                }
                if(current < text.length - 1){
                    replacedText = text.substr(current);
                }

                if(replacedText.indexOf('"') >= 0){
                    result += " " + attr + "='" + replacedText + "'";
                }else{
                    result += " " + attr + '="' + replacedText + '"';
                }
            }
        }

        // 「br」のみタグの終了前に「/」を追加する
        if(this.tagName === 'br'){
            result += "/";
        }

        // タグの終了カッコ(>)を設定
        result += ">";
        
        // 内部のコンテンツをHTMLにして設定する
        for(let item of this.contents){
            if(item instanceof SvelteTag){
                if(compornents[item.tagName]){
                    // 子コンポーネントの場合は子コンポーネントのHTMLを取得する
                    let changedAttrs = item.getChangedAttributes(variables);
                    result += compornents[item.tagName].getHtml(changedAttrs);
                }else{
                    // 子コンポーネントでない場合はそのタグのHTMLを取得する
                    result += item.getHtml(variables, compornents);
                }
            }else{
                // テキストの場合はそのHTMLを取得する
                result += item.getHtml(variables, compornents);
            }
        }

        // 終了タグを持たないタグ以外は終了タグを設定
        if(singleTags.indexOf(this.tagName) < 0) {
            result += "</" +  this.tagName + ">";
        }

        return result;
    }

    // classの中でファイルスコープのstyleに設定されているものを調整する
    public convertCss(className:string, replaceClassName:string, tagName:string){

        if(tagName === ''){
            // css内に該当するクラスはファイル名_を追加したものに変更する
            if(this.attributes["class"]){
                let classList = this.attributes["class"].trim().replace(/\s\s+/g, ' ').split(' ');
                let index = classList.indexOf(className);
                if(index >= 0){
                    classList.splice(index,1);
                    classList.splice(index,0,replaceClassName);
                }
                let classListStr = "";
                for(let item of classList){
                    classListStr += item + ' ';
                }
                this.attributes["class"] = classListStr.trim();
            }
        }else{
            // タグ名が同じなら変更する
            if(this.tagName === tagName){
                if(this.attributes["class"]){
                    this.attributes["class"] = replaceClassName + ' ' + this.attributes["class"];
                }
                else{
                    this.attributes["class"] = replaceClassName;
                }
            }
        }

        for(let content of this.contents){
            if(content instanceof SvelteTag){
                content.convertCss(className, replaceClassName, tagName);
            }
        }
    }

    // タグの属性の連想配列を設定
    // [引数]   tagText     タグの属性部分の文字列
    private createAttributes(tagText:string){
        tagText = tagText.trim();
        let findInfo = multiIndexOf(tagText,0,[' ','=']);
        let current = 0;
        while(findInfo.index >= 0){
            if(findInfo.findstr === ' '){
                let attrName = tagText.substr(current,findInfo.index - current).trim();
                let noSpaceIndex = passSpaceAndTab(tagText, findInfo.index);
                if(tagText.substr(noSpaceIndex,1) === '='){
                    noSpaceIndex = passSpaceAndTab(tagText, noSpaceIndex + 1);
                    let attrValInfo = getAttrValue(tagText, noSpaceIndex);
                    this.attributes[attrName] = attrValInfo.attrVal;
                    current = passSpaceAndTab(tagText,attrValInfo.index);
                    findInfo = multiIndexOf(tagText,current,[' ','=']);
                }else{
                    this.attributes[attrName] = attrName;
                    current = noSpaceIndex;
                    findInfo = multiIndexOf(tagText,current,[' ','=']);
                }
            }else{
                let attrName = tagText.substr(current,findInfo.index - current).trim();
                let noSpaceIndex = passSpaceAndTab(tagText, findInfo.index + 1);
                let attrValInfo = getAttrValue(tagText, noSpaceIndex);
                this.attributes[attrName] = attrValInfo.attrVal;
                current = passSpaceAndTab(tagText,attrValInfo.index);
                findInfo = multiIndexOf(tagText,current,[' ','=']);
            }
        }

        // // 複数のスペースとタブを一つのスペースに置き換える
        // tagText = tagText.replace(/\s\s+/g, ' ');

        // // 「=」の前後のスペースを削除する
        // tagText = tagText.replace(/ =/g,'=');
        // tagText = tagText.replace(/= /g,'=');

        // // プレースフォルダ内のスペースを無視するために、一旦置き換える
        // // プレースフォルダは<0 で0の部分は配列に格納したプレースフォルダの文字列の配列のインデックス
        // // プレースフォルダ自身は別の配列に一時対比
        // let placeFolders:string[] = [];
        // let tagtext2 = "";
        // let current = 0;
        // let startIndex = tagText.indexOf('{');
        // let placeIndex = 0;
        // while(startIndex >= 0){
        //     if(startIndex > current){
        //         tagtext2 += tagText.substr(current, startIndex - current);
        //     }
            
        //     let endIndex = tagText.indexOf('}',startIndex);
        //     if(endIndex < 0){
        //         tagtext2 += '<' + placeIndex.toString() + '>';
        //         placeIndex ++;
        //         placeFolders.push(tagText.substr(startIndex));
        //         endIndex = tagText.length - 1
        //     }else{
        //         const work = tagText.substr(startIndex, endIndex - startIndex + 1);
        //         tagtext2 += '<' + placeIndex.toString() + '>';
        //         placeIndex ++;
        //         placeFolders.push(work);
        //     }
        //     current = endIndex + 1;
        //     startIndex = tagText.indexOf('{', current);
        // }
        // if(current < tagText.length - 1){
        //     tagtext2 += tagText.substr(current);
        // } 

        // // スペースを1つずつにして「=」の前後のスペースを削りプレースフォルダを置き換えた文字列で
        // // スペースで分割して属性の連想配列を作成するこの時プレースフォルダの内容は配列から戻す
        // if(tagtext2.length > 0){
        //     // スペースで分割する
        //     let attributes = tagtext2.split(' ');

        //     // アトリビュートを設定する
        //     for(let attr of attributes){
        //         let equalIndex = attr.indexOf('=');
        //         if(equalIndex < 0){
        //             if(attr.substr(0,1) === '<'){
        //                 let placeFolder = placeFolders[Number(attr.substr(1))];
        //                 let attrName = placeFolder.replace('{','').replace('}','');
        //                 this.placeFolderAttributes[attrName] = placeFolder;
        //             }else{
        //                 this.attributes[attr] = '';
        //             }
        //         }else if(equalIndex > 0){
        //             let attrPair = attr.split('=');
        //             let praceFolderIndex = attrPair[1].indexOf('<');
        //             if(praceFolderIndex >= 0){
        //                 let attrName = attrPair[0];
        //                 let colonIndex = attrName.indexOf(':');
        //                 if(colonIndex >=0){
        //                     attrName = attrName.substr(colonIndex + 1);
        //                 }
        //                 let endIndex = attrPair[1].indexOf('>', praceFolderIndex);
        //                 let placeFolderIndex = Number(attrPair[1].substr(praceFolderIndex + 1, endIndex - praceFolderIndex - 1));
        //                 this.placeFolderAttributes[attrName] = "";
        //                 if(praceFolderIndex > 0){
        //                     this.placeFolderAttributes[attrName] += attrPair[1].substr(1,praceFolderIndex -1);
        //                 } 
        //                 this.placeFolderAttributes[attrName] += placeFolders[placeFolderIndex];
        //                 if(endIndex < attrPair[1].length -2){
        //                     this.placeFolderAttributes[attrName] += attrPair[1].substr(endIndex + 1, attrPair[1].length - endIndex -2);
        //                 }
        //             }else{
        //                 let attrName = attrPair[0];
        //                 let colonIndex = attrName.indexOf(':');
        //                 if(colonIndex >=0){
        //                     attrName = attrName.substr(colonIndex + 1);
        //                 } 
        //                 let val = attrPair[1].trim();
        //                 if((val.substr(0,1) === '"') || (val.substr(0,1) === "'")){
        //                     this.attributes[attrName] = val.substr(1,val.length -2);
        //                 }else{
        //                     this.attributes[attrName] = val;
        //                 }
        //             }
        //         }
        //     }
        // }
    }
}

//================================================================================
//  Svelteのドキュメント（ファイルの情報）
//================================================================================
export class SvelteDoc{

    // プロパティ
    public filename = "";                                   // ファイル名（スコープcss名で利用）
    public tags:SveltePart[] = [];                          // scriptとsyleを除くタグリスト
    public scriptsText = "";                                // scriptのタグ内のテキスト
    public stylesText = "";                                 // styleのタグ内のテキスト
    public classes:{[key:string]:string} = {};              // styleに設定されているcssクラスの連想配列
    public compornents:{ [key: string] :SvelteDoc} = {};    // サブコンポーネントリスト

    // テキストファイルを読み込んでタグリストを作成する
    // [引数]   filepath    読み込むファイルパス
    public readFile(filepath:string){

        // ファイル名の設定
        const path = require('path');
        this.filename = path.basename(filepath).replace(".svele", "");

        // ファイルの読み込み
        const fs = require('fs');
        var fileText = fs.readFileSync(filepath, 'utf8');
        
        // ファイル内容をコンテンツリストにする
        var res = this.getPartsList(fileText, 0, "");
        this.tags = res.contents;

        // CSSをスコープ内になるように変換
        this.convertCss();

        // 配下のコンポーネントを読み込む
        this.getCompornents(path.dirname(filepath));

    }

    // html文字列の取得
    public getHtml(tagAttributes:{[key:string]:string}):string{
        this.setScriptParams(tagAttributes);

        let result = "";
        for(let tag of this.tags){
            if(tag instanceof SvelteTag){
                if(this.compornents[tag.tagName]){
                    // 子コンポーネントの場合は子コンポーネントのHTMLを取得する
                    let changedAttrs = tag.getChangedAttributes(tagAttributes);
                    result += this.compornents[tag.tagName].getHtml(changedAttrs);
                }else{
                    // 子コンポーネントでない場合はそのタグのHTMLを取得する
                    result += tag.getHtml(tagAttributes, this.compornents);
                }
            }else{
                // テキストの場合はそのHTMLを取得する
                result += tag.getHtml(tagAttributes, this.compornents);
            }
        }
        return result;
    }

    // 配下のコンポーネントを読み込む
    // 自身のコンポーネントのフォルダパス
    public getCompornents(currentPath:string){

        const path = require('path');

        let startIndex = this.scriptsText.indexOf("import ");
        while(startIndex >= 0){
            let fromStart = this.scriptsText.indexOf("from ", startIndex);
            if(fromStart >= 0){
                let lineEnd = this.scriptsText.indexOf(";", fromStart);
                if(this.scriptsText.indexOf("\n", fromStart) < lineEnd){
                    lineEnd = this.scriptsText.indexOf("\n", fromStart);
                } 
                if(lineEnd >= 0){
                    let key = this.scriptsText.substr(startIndex + 7, fromStart - (startIndex + 7));
                    key = key.replace("{","").replace("}","").trim();
                    let importFile = this.scriptsText.substr(fromStart + 5, lineEnd - (fromStart + 5));
                    importFile = importFile.replace(/\"/g,"").replace(/\'/g,"").trim();
                    if(importFile.substr(importFile.lastIndexOf('.') + 1).toLowerCase() === 'svelte')
                    {
                        let doc = new SvelteDoc();
                        doc.readFile(path.join(currentPath, importFile));
                        this.compornents[key] = doc;
                    }
                    startIndex = lineEnd;
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

    // スコープCSSを取得する
    public getCss():string{
        let result ="";
        for(let classSelector in this.classes){
            result += classSelector + this.classes[classSelector] + '\n';
        }

        for(let comporntnt in this.compornents){
            result += this.compornents[comporntnt].getCss();
        }

        return result;
    }

    // ファイル内で定義されているスコープCSSをファイル名付きのCSSに変更する
    private convertCss(){
        
        // styleタグ内のテキストから「{」を取得
        let current = 0;
        let startIndex = this.stylesText.indexOf('{');
        while(startIndex >= 0){
            // {までをセレクタとして取得
            let className = this.stylesText.substr(current,startIndex - current).trim();

            // {}で囲まれた範囲をCSSの設定内容として取得
            let endIndex = this.stylesText.indexOf('}', startIndex);
            var classValue = "";
            if(endIndex < 0){
                classValue = this.stylesText.substr(startIndex);
                startIndex = this.stylesText.length;
            }else{
                classValue = this.stylesText.substr(startIndex, endIndex - startIndex + 1 );
                startIndex = endIndex + 1;
            }
            
            //「.」の存在を確認して、存在する場合はクラス名の前にファイル名_を追加してファイル内のタグのclass名を変更。
            // ない場合は後ろに.ファイル名を追加しファイル内のタグのclassの先頭に追加
            let splited = className.trim().split('.');
            let replaceClassName = "";
            let tagName = "";
            if(splited.length < 3){
                replaceClassName = splited[0] + '.' + this.filename.toLowerCase().replace('.svelte','');
                tagName = splited[0] ;
                if(splited.length === 2){
                    replaceClassName += '_' + splited[1];
                    tagName = "";
                }
            }
            this.classes[replaceClassName] = classValue;
            let changeClassName = "";
            if(className.indexOf('.') >= 0){
                changeClassName = className.substr(className.indexOf('.') + 1);
            } 
            let changereplaceClassName = replaceClassName.substr(replaceClassName.indexOf('.') + 1);
            for(let tag of this.tags){
                if(tag instanceof SvelteTag){
                    tag.convertCss(changeClassName, changereplaceClassName, tagName);
                }
            }

            startIndex = this.stylesText.indexOf('{', startIndex);
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
        let findInfo = multiIndexOf(text, currentIndex, ['let','const','var']);
        while(findInfo.index > 0){
            let valInfo = this.getValiableInfo(text, findInfo.index + findInfo.findstr.length);
            if(!tagAttributes[valInfo.key]){
                tagAttributes[valInfo.key] = valInfo.val;
            }
            currentIndex = valInfo.index;
            findInfo = multiIndexOf(text, currentIndex, ['let','const','var']);
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
                let info = multiIndexOf(text, index, ['=', ' ']);
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
            // 文字列でなければ変数は空文字列を値として返す
            return {key:valName, val:"", index:(index + 1)};
        }
    }

    // 内部のコンポーネントを読み込んで設定
    public replaceCompornents(basePath:string)
    {

    }

    // テキストの指定の開始位置からのタグ内のコンテンツリストとタグの終了位置を取得する
    // [引数]   fileText        対象のテキスト
    //          startIndex      開始位置
    //          startTagName    親のタグ名（空の場合はトップレベル）
    // [返値]   endIndex        終了位置
    //          contents        コンテンツリスト
    private getPartsList(fileText:string, startIndex:number, startTagName:string):{endIndex:number, contents:SveltePart[]}{

        const parts:SveltePart[] = [];

        // タグの開始位置を取得
        var tagStart = fileText.indexOf('<', startIndex);

        while(true){

            // タグ開始位置が無いのであれば、残りの処理をして結果を返す
            if(tagStart < 0){

                // 開始位置からファイルの最後までに文字列が存在する場合、それをテキスト情報等して追加する
                if(startIndex < fileText.length){
                    var lastText = this.deleteSvelteAction(startTagName, fileText.substr(startIndex, fileText.length - startIndex).trim());
                    if(lastText.length >0){
                        parts .push(new SvelteText(lastText));
                    }
                }

                // ファイルの最後の位置と作成したコンテンツ配列を返す
                return {endIndex:fileText.length, contents:parts};
            }

            // タグの終了位置を取得
            var tagEnd = getTagEnd(fileText, tagStart);
            
            // タグ内の文字列からタグを作成する
            const tagStr = fileText.substr(tagStart + 1, tagEnd - tagStart - 1).trim();
            let tagName = tagStr;
            let tagText = "";
            if(tagStr.indexOf(' ') > 0){
                tagName = tagStr.substr(0,tagStr.indexOf(' '));
                tagText = tagStr.substr(tagStr.indexOf(' ') + 1).trim();
            } 
            if(tagName.substr(0,1) === '/'){
                
                // 自身のタグの終了タグなら終了処理
                if(tagName.substr(1) === startTagName){
                    // タグの開始位置前に文字列があればそれをパーツとして設定
                    var preStrings = this.deleteSvelteAction(startTagName, fileText.substr(startIndex, tagStart - startIndex).trim());
                    if(preStrings.length > 0) {
                        parts.push(new SvelteText(preStrings));
                    }
                    // 終了タグだったので、そこまでの部品リストを返す
                    return { endIndex:tagEnd, contents:parts};
                }else{
                    // 次のタグの開始位置を取得してループしなおす
                    tagStart = fileText.indexOf('<', tagEnd);
                }
            }else{
                // タグの開始位置前に文字列があればそれをパーツとして設定
                var preStrings = this.deleteSvelteAction(startTagName, fileText.substr( startIndex, tagStart - startIndex).trim());
                if(preStrings.length > 0) {
                    parts.push(new SvelteText(preStrings));
                }

                if(singleTags.indexOf(tagName.toLowerCase()) >= 0){
                    // 終了タグが無いものは単一タグを追加する
                    parts.push(new SvelteTag(tagName, tagText));
                    startIndex = tagEnd + 1;
                }else{
                    if(tagName.toLowerCase() === 'script'){
                        const scriptEnd = fileText.indexOf('/script', tagEnd + 1);
                        if(scriptEnd < 0){
                            if(tagEnd + 1 < fileText.length - 1){
                                this.scriptsText += fileText.substr(tagEnd + 1) + '\n';
                            }
                            startIndex = fileText.length;
                        }else{
                            this.scriptsText += fileText.substr(tagEnd + 1, scriptEnd - (tagEnd + 1))+ '\n';
                            startIndex = fileText.indexOf('>', scriptEnd + 1) + 1;
                        }
                    }else if(tagName.toLowerCase() === 'style'){
                        const styleEnd = fileText.indexOf('/style', tagEnd + 1);
                        if(styleEnd < 0){
                            if(tagEnd + 1 < fileText.length - 1){
                                this.stylesText += fileText.substr(tagEnd + 1) + '\n';
                            }
                            startIndex = fileText.length;
                        }else{
                            this.stylesText += fileText.substr(tagEnd + 1, styleEnd - (tagEnd + 1))+ '\n';
                            startIndex = fileText.indexOf('>', styleEnd + 1) + 1;
                        }
                    }else{
                        // タグ情報を作成してタグの内部情報を取得する
                        var newTag = new SvelteTag(tagName, tagText);
                        const res = this.getPartsList(fileText,tagEnd + 1, newTag.tagName);
                        newTag.contents = res.contents;
                        parts.push(newTag);
                        startIndex = res.endIndex + 1;
                    }
                    
                }

                // if(startIndex >= fileText.length) return { endIndex:startIndex, contents:parts};
                tagStart = fileText.indexOf('<', startIndex);
            }
        }
    }

    // テキスト情報の中のSvelteの制御用のプレースフォルダを削除する
    // [引数]   tagName タグ名（scriptは除外する為）
    //          text    テキスト情報
    // [返値]   Svelteの制御用のプレースフォルダを削除した文字列
    private deleteSvelteAction(tagName:string, text:string):string{

        if(tagName.toLowerCase() === 'script' ){
            return text;
        } 

        let current = 0;
        let result = "";

        // 「{」の位置を取得無ければプレースフォルダがない
        let startIndex = text.indexOf('{');
        while(startIndex >=0){
            // 「}」の位置を取得。無ければループを終了
            let endIndex = getPlacefolderEnd(text, startIndex);
            if(endIndex < 0){
                break;
            } 

            // 開始位置までの文字列はそのまま追加
            if(startIndex > current){
                result += text.substr(current, startIndex - current);
            } 

            // {}内の文字列を単語に分割
            const inText = text.substr(startIndex + 1, endIndex - startIndex - 1);
            const items = inText.split(/\s+/);

            // 最初の文字がsvelteの制御なら除外
            if(svelteControlMarks.indexOf(items[0].substr(0,1)) < 0){

                // 最初の文字列が「@debug」なら除外 
                if(items[0].toLowerCase() !== '@debug'){

                    // 関数が入っている場合は除外
                    if(inText.indexOf('(') < 0){
                        result += text.substr(startIndex, endIndex - startIndex +1);
                    }
                }
            }
            current = endIndex + 1;
            startIndex = text.indexOf('{',current);
        }

        // 残りの文字列を追加
        if(current < text.length){
            result += text.substr(current, text.length - current);
        } 

        return result;
    }
}