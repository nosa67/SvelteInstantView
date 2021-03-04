import { stringify } from 'querystring';
import * as vscode from 'vscode';
import * as path from 'path';
import {JSDOM}  from 'jsdom';
import * as fs from 'fs';
import * as sass from 'sass';

const fileAddition:string = "_tmpview";

// ダミーのスタイルクラス名のヘッダ
const styleNameHeader = "dmy-class-";

let cssTempFile:string;
let svelteTempFile:string;
let classIndex =1;

//====================================================================================================
//  svelteのインスタントビューを表示
//====================================================================================================
export function showSvelteView(context: vscode.ExtensionContext, targetFile:any){

    // 一時ファイルの作成
    const svelteTempFile = createTempSvelteFile(context, targetFile.fsPath);

    // 一時ファイルができなかったら処理しない
    if(svelteTempFile.length > 0 ){

        // 一時ファイルのブラウザ表示
        showBrowser("" + vscode.workspace.getConfiguration('svelte-instant-view').get('browser'), svelteTempFile);

        // 10秒後に一時ファイルを削除
        deleteSvelteTempFIle();
    }
}

export function showSvelteViewEditting(context: vscode.ExtensionContext, targetFile:any, edittingText:string){

    // 一時ファイルの作成
    const svelteTempFile = createTempSvelteFile(context, targetFile.fsPath, edittingText);

    // 一時ファイルができなかったら処理しない
    if(svelteTempFile.length > 0 ){

        // 一時ファイルのブラウザ表示
        showBrowser("" + vscode.workspace.getConfiguration('svelte-instant-view').get('browser'), svelteTempFile);

        // 10秒後に一時ファイルを削除
        deleteSvelteTempFIle();
    }
}

//----------------------------------------------------------------------------------------------------
// 表示用一時ファイルの作成
//----------------------------------------------------------------------------------------------------
function createTempSvelteFile(context: vscode.ExtensionContext, svelteFilePath:string, tetDoc?:string | undefined): string
{
    if(vscode.workspace.workspaceFolders !== undefined){

        // 設定されているベースファイルを取込んでDOMにする
        let baseFilePath =  path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "" + vscode.workspace.getConfiguration('svelte-instant-view').get('baseFile'));
        var baseHtml = fs.readFileSync(baseFilePath, 'utf8');
        const baseDOM = new JSDOM(baseHtml);
    
        // svelteファイルを読み込んでDocumentを取得する
        let svelteHtml = (tetDoc === undefined )?fs.readFileSync(svelteFilePath, 'utf8'):tetDoc;
        const svelteDoc = new JSDOM(svelteHtml).window.document;
    
        // svelteファイルの存在するフォルダを取得
        let lastFolderPos = Math.max(svelteFilePath.lastIndexOf("\\"),svelteFilePath.lastIndexOf("/"));
        const parentPath = svelteFilePath.substr(0, lastFolderPos);

        // svelteファイルで利用コンポーネントのタグを埋め込み、それぞれのスタイルをダミーのクラスセレクタに変更する。変更した全てのCSSデータを受け取る
        classIndex = 1;
        let cssAllText = getChildAndConvertCss(svelteDoc,parentPath);

        // ベースファイルからsvelteのjavascriptを除去する(設定の「disableScript」に設定されている文字列をsrcに含むscriptタグ)
        exceptSvelteScript(baseDOM);

        // linkタグのsrcでルート相対パスがあれば相対パスに変更する
        changeRootRfPath(baseDOM);

        // svelteファイルのhtmlをベースファイルのドキュメントに埋め込み
        setSveltHtml(baseDOM, svelteDoc);

        // ベースファイルのパスの拡張子を除いたものを取得
        let tmpFileBasePath = baseFilePath.substr(0,baseFilePath.lastIndexOf("."));

        // css一時ファイルの作成
        cssTempFile = tmpFileBasePath + fileAddition + ".css";
        fs.writeFileSync(cssTempFile, cssAllText);

        // 保存したcssファイルを取り込むようにベースファイルのドキュメントに埋め込
        let cssFileOnlyName = cssTempFile.substring(cssTempFile.lastIndexOf('\\') + 1);
        let cssLinkElement = baseDOM.window.document.createElement("link");
        cssLinkElement.setAttribute("rel", "stylesheet");
        cssLinkElement.setAttribute("href", cssFileOnlyName);
        baseDOM.window.document.getElementsByTagName("HEAD")[0].appendChild(cssLinkElement);

        // svelteの一時ファイルを出力
        svelteTempFile = tmpFileBasePath + fileAddition + ".html";
        fs.writeFileSync(svelteTempFile, baseDOM.serialize());

        return svelteTempFile;
    }else{
        throw new Error("NO workspase opens !");
    }
}

//--------------------------------------------------------------------------------
//  ドキュメントの子コンポーネントのHTMLを取り込み、SASS,SCSSを変換し
//  CSSをスコープになるようにユニーク名のクラスに変換
//  最終的に統合したCSSデータを返す。
//--------------------------------------------------------------------------------
function getChildAndConvertCss(svelteDoc:Document, parentFolderPath:string)
{
    // CSSを変換して取得する（ユニークなクラスにして、ドキュメント内も変換しておく）
    let returnCss = getConvertCss(svelteDoc.body);

    // スクリプトのimportのリストを取得する
    var compornents = getImportList(svelteDoc);

    // importリストを利用して、子コンポーネントを置き換える。配下のCSSが返ってくるので追加する
    returnCss += setChildCompornents(svelteDoc, parentFolderPath, compornents);

    // 全てのCSSのテキスト返す
    return returnCss;
}

//--------------------------------------------------------------------------------
// スクリプトのimportのリストを取得する
//--------------------------------------------------------------------------------
function getImportList(doc:Document): { [key: string] : string; } {

    // importに設定されている子コンポーネントと思われる物のリスト（名前と相対ファイル名）
    var compornents: { [key: string] : string; } = {};

    // svelteのボディーからスクリプトタグのimportを調べて再帰的に設定する
    for(let i = 0;i < doc.scripts.length;i ++){
        const scriptText = doc.scripts[i].innerHTML;
        let startIndex = scriptText.indexOf("import ");
        while(startIndex >= 0){
            let fromStart = scriptText.indexOf("from ", startIndex);
            if(fromStart >= 0){
                let lineEnd = scriptText.indexOf(";", fromStart);
                if(lineEnd >= 0){
                    let key = scriptText.substr(startIndex + 7, fromStart - (startIndex + 7));
                    key = key.replace("{","").replace("}","").trim();
                    let importFile = scriptText.substr(fromStart + 5, lineEnd - (fromStart + 5));
                    importFile = importFile.replace(/\"/g,"").replace(/\'/g,"").trim();
                    compornents[key] = importFile;
                    startIndex = lineEnd;
                }
                else{
                    startIndex = fromStart; 
                }
            }else{
                startIndex = startIndex + 7;
            }
            startIndex = scriptText.indexOf("import ", startIndex);
        }
    }

    return compornents;
}

//--------------------------------------------------------------------------------
// importリストを利用して、子コンポーネントを置き換える
//--------------------------------------------------------------------------------
function setChildCompornents(doc:Document, parentFolderPath:string, compornents:{ [key: string] : string; }) : string{

    let returnCss = "";

    // 全てのコンポーネントリストを処理する
    Object.keys(compornents).forEach(key => {
        let targetTags = doc.body.getElementsByTagName(key);
        if(targetTags.length > 0){
            let targetFilePath = parentFolderPath + "/" + compornents[key];
            var compornentHtml = fs.readFileSync(targetFilePath, 'utf8');     // パスのファイルを読み込む
            const compornentDOM = new JSDOM(compornentHtml);                        // 読み込んだファイルをDOMにする
            const compornentDoc = compornentDOM.window.document;
            const parentPath = targetFilePath.substr(0, targetFilePath.lastIndexOf("/"));
            returnCss = returnCss + "\n" + getChildAndConvertCss(compornentDoc, parentPath);
             for(let i = 0;i < targetTags.length; i ++){
                targetTags[i].innerHTML = compornentDoc.body.innerHTML;
            }
        }
        
    });

    return returnCss;
}

//--------------------------------------------------------------------------------
// cssをスコープにするためにセレクタを特別な名称のクラスセレクタに変更し、タグのclas属性の先頭に挿入する
//--------------------------------------------------------------------------------
function getConvertCss(htmlBody:HTMLElement)
{
    // スタイルシートのタグリストを取得する
    let styleElements = htmlBody.getElementsByTagName("style");

    // 全てのスタイルシートの情報をCSSで取得する（sassやscssは変換する）
    let allCss = getAllStyles(styleElements);

    // 既存のスタイルタグをすべて削除する
    for (var i = 0; i < styleElements.length; i++) {
        let parent = styleElements[i].parentElement;
        if(parent !== null){
            parent.removeChild(styleElements[i]);
        }
    }

    if(allCss.length > 0){
        // 取得したスタイルのセレクタをユニークなクラスにしてHTMLのclassの先頭に追加。返還後のCSSを返す
        return setConvertedStyles(htmlBody, allCss);
    }else{
        return "";
    }
}

//--------------------------------------------------------------------------------
// 全てのスタイルシートの情報を取得する
//--------------------------------------------------------------------------------
function getAllStyles(styleElements: HTMLCollectionOf<HTMLStyleElement>): string{

    // スタイルシートのリスト（css,asasss,scss）からcss形式のデータを取得してまとめる
    let allCss = "";
    for(let i = 0; i < styleElements.length; i ++)
    {
        // svelteのスタイルの言語（[css],sass,scss）を取得
        let attrLang = "css";
        if(styleElements[i].getAttribute("lang") !== null){
            let attrLang = styleElements[i].getAttribute("lang");
            if(attrLang !== null){
                attrLang = attrLang.toLowerCase();
            }
        } 

        // styleタグの属性が「sass」や「scss」ならcssに変換して保存。それ以外ならそのまま保存
        if((attrLang === "sass") || (attrLang === "scss") ){
            let tmpSassFilePath = fileAddition + "." + attrLang;
            fs.writeFileSync(tmpSassFilePath, styleElements[i].innerHTML);
            allCss = allCss + sass.renderSync({file: tmpSassFilePath}).css.toString();
            fs.unlinkSync(tmpSassFilePath);
        }else{
            allCss = allCss + styleElements[i].innerHTML;
        }
    }
    
    return allCss;
}

//--------------------------------------------------------------------------------
// 取得したスタイルのセレクタをユニークなクラスにしてHTMLのclassの先頭に追加。返還後のCSSを返す
//--------------------------------------------------------------------------------
function setConvertedStyles(htmlBody:HTMLElement, allCss:string): string{

    let resultCSS = "";
        
    // 全てのcssを設定したstyleタグを作成する
    var workStyeleElement = htmlBody.ownerDocument.createElement("style");
    workStyeleElement.innerHTML = allCss;
    htmlBody.insertBefore(workStyeleElement, htmlBody.firstChild);
    let styleSheet = htmlBody.ownerDocument.styleSheets[0];

    // 全てのルールをユニーク名に変更する
    for(let i =0; i < styleSheet.cssRules.length; i ++){
        let targetRule = styleSheet.cssRules[i];
        let dummyClassName = styleNameHeader + classIndex.toString(); 
        classIndex ++;
        let targetElements = htmlBody.querySelectorAll(getSelectorText(targetRule));
        for(let j = 0; j < targetElements.length; j ++){
            let classAttr = targetElements[j].getAttribute("class");
            if(classAttr === null){
                targetElements[j].setAttribute("class", dummyClassName);
            }else{
                targetElements[j].setAttribute("class", dummyClassName + " " + classAttr);
            }
        }
        setSelectorText(targetRule, "." + dummyClassName);
        resultCSS += targetRule.cssText;
    }

    // 作ったスタイルは削除
    let styleElement = htmlBody.getElementsByTagName("style")[0];
    let parent = styleElement.parentElement;
    if(parent !== null){
        parent.removeChild(styleElement);
    }

    // 結果のCSS(テキスト)を返す
    return resultCSS;
}

//--------------------------------------------------------------------------------
//  スタイルのセレクタを取得する（ちょっとダサいなー）
//--------------------------------------------------------------------------------
function getSelectorText(arg: any): string {
    if(arg !== null){
            if(typeof arg === "object"){
            if(typeof arg.selectorText === "string"){
                return arg.selectorText;
            }
        }
    }
    return "";
}

//--------------------------------------------------------------------------------
//  スタイルのセレクタを設定する（ちょっとダサいなー）
//--------------------------------------------------------------------------------
function setSelectorText(arg: any, newValue:string) {
    if(arg !== null){
            if(typeof arg === "object"){
            if(typeof arg.selectorText === "string"){
                arg.selectorText = newValue;
            }
        }
    }
}

//--------------------------------------------------------------------------------
/// ベースファイルからsvelteのjavascriptを除去する(設定の「disableScript」に設定されている文字列をsrcに含むscriptタグ)
//--------------------------------------------------------------------------------
function exceptSvelteScript(baseDOM:JSDOM){

    let disableScript = "" + vscode.workspace.getConfiguration('svelte-instant-view').get('disableScript');
    let baseScriptElements = baseDOM.window.document.getElementsByTagName("script");
    for (let i = 0; i < baseScriptElements.length; i++) {
        let scriptElement = baseScriptElements[i];
        let srcAttr = scriptElement.getAttribute("src");
        if (srcAttr !== null) {
            if (srcAttr.toLowerCase().indexOf(disableScript) >= 0) {
                if (scriptElement.parentElement !== null) {
                    scriptElement.parentElement.removeChild(baseScriptElements[i]);
                }
                break;
            }
        }
    }
}

//--------------------------------------------------------------------------------
// linkタグのsrcでルート相対パスがあれば相対パスに変更する
//--------------------------------------------------------------------------------
function changeRootRfPath(baseDOM:JSDOM){
        
        let baseLinkElements = baseDOM.window.document.getElementsByTagName("link");
        for(let i= 0;i < baseLinkElements.length; i ++ ){
            let workAttr = baseLinkElements[i].getAttribute("href");
            if(workAttr !== null){
                if(workAttr[0] === "/"){
                    baseLinkElements[i].setAttribute("href", workAttr.substr(1));
                }
            }
            
        }

}

//--------------------------------------------------------------------------------
// svelteファイルのhtmlをベースファイルのドキュメントに埋め込み
//--------------------------------------------------------------------------------
function setSveltHtml(baseDOM:JSDOM, svelteDoc:Document){

    let insertElementTagselector = vscode.workspace.getConfiguration('svelte-instant-view').get<string>('insertTagSelector');
    if(insertElementTagselector !== undefined){
        let insertElement = baseDOM.window.document.querySelector( insertElementTagselector);
        if(insertElement === null){
            throw new Error("Can't find TAG(selector = " + vscode.workspace.getConfiguration('svelte-instant-view').get('insertTagSelector') + ") in base html.");
        }
        insertElement.innerHTML = svelteDoc.body.innerHTML;
    }
}


//--------------------------------------------------------------------------------
// 一時ファイルのブラウザ表示
//--------------------------------------------------------------------------------
function showBrowser(browserName:string, svelteTempFilePath:string)
{
    if(browserName === "chrome"){
        doCommand('start chrome.exe "' + svelteTempFilePath + '"');
    }else if(browserName === "firefox"){
        doCommand('start firefox.exe "' + svelteTempFilePath + '"');
    }else if(browserName === "edge"){
        doCommand('start shell:Appsfolder\\Microsoft.MicrosoftEdge_8wekyb3d8bbwe!MicrosoftEdge "' + svelteTempFilePath + '"');
    }
}

//--------------------------------------------------------------------------------
// 30秒後に一時ファイルを削除
//--------------------------------------------------------------------------------
function deleteSvelteTempFIle()
{
    setTimeout(() => {
        // ファイル操作モジュールの追加
        var fs = require('fs');

        // svelte一時ビューファイルの削除
        fs.unlinkSync(svelteTempFile);

        // 一時cssファイルの削除
        if(cssTempFile.length > 0){
            fs.unlinkSync(cssTempFile);
        }
      }, 10000);
}

//====================================================================================================
// シェルコマンドを非同期実行する
//====================================================================================================
function doCommand(cmd:string) : Promise<string>
{
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        var jschardet = require('jschardet');
        var iconv = require('iconv-lite');

        // コマンドを実行
        exec(cmd, (err: any, stdout: any, stderr: any) => {
            if (err) {
                // エラーならエラーメッセージをutf-8でスロー
                var errorCharset = jschardet.detect(err);
                reject (iconv.decode(err, errorCharset.encoding));
            }
        
            // 標準出力の内容をutf-8にデコードして返す
            var resultChareset = jschardet.detect(stdout);
            resolve (iconv.decode(stdout, resultChareset.encoding));
        });
    });
}