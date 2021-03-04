import { stringify } from 'querystring';
import * as vscode from 'vscode';
import * as path from 'path';

const fileAddition:string = "_tmpview";
let svelteTempFile:string = "";
let cssTempFile:string = "";

//====================================================================================================
//  svelteのインスタントビューを表示
//====================================================================================================
export default function showSvelteView(context: vscode.ExtensionContext, targetFile:any){

    // 一時ファイルの作成
    createTempSvelteFile(context, targetFile.fsPath);

    // 一時ファイルができなかったら処理しない
    if(svelteTempFile.length > 0 ){

        // 一時ファイルのブラウザ表示
        showBrowser("" + vscode.workspace.getConfiguration('svelte-instant-view').get('browser'), svelteTempFile);

        // 10秒後に一時ファイルを削除
        deleteSvelteTempFIle();
    }
}

//----------------------------------------------------------------------------------------------------
// 一時ファイルの作成
//----------------------------------------------------------------------------------------------------
function createTempSvelteFile(context: vscode.ExtensionContext, svelteFilePath:string)
{
    if(vscode.workspace.workspaceFolders !== undefined){

        // html ドキュメントモジュールの追加
        const {JSDOM} = require('jsdom');

        // ファイル操作モジュールの追加
        var fs = require('fs');

        // 設定されているベースファイルを取込んでドキュメントオブジェクトにする
        let baseFilePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "" + vscode.workspace.getConfiguration('svelte-instant-view').get('baseFile'));
        var baseHtml = fs.readFileSync(baseFilePath, 'utf8');
        const baseDoc = new JSDOM(baseHtml);
    
        // 一時ファイルの名前を作成する（表示するsvelteのファイル名に固定の文字列を追加して拡張子を「html」にしたもの）
        let delimitPos = baseFilePath.lastIndexOf(".");
        let tmpFileName = baseFilePath.substr(0,delimitPos);
        svelteTempFile = tmpFileName + fileAddition + ".html";
        
        // svelteファイルの取り込みとスタイルタグと埋め込みhtmlタグの取得
        let svelteHtml = fs.readFileSync(svelteFilePath, 'utf8');
        const svelteDoc = new JSDOM(svelteHtml).window.document;
        let styleElement:any = undefined;
        let htmElement:any = undefined;
        for(let el of svelteDoc.getElementsByTagName("body")[0].children){
            if(el.tagName === "STYLE"){
                styleElement = el;
            }else if(el.tagName !== "SCRIPT"){
                htmElement = el;
            }
        }

        // svelteファイルのスタイルシートの一時ファイルを作成しそのパスをベースファイルのドキュメントに埋め込み
        if(styleElement !== undefined)
        {
            // css一時ファイルパスの作成
            cssTempFile = tmpFileName + fileAddition + ".css";

            // svelteのスタイルの言語（[css],sass,scss）を取得
            let attrLang = styleElement.getAttribute("lang").toLowerCase();

            // styleタグの属性が「sass」や「scss」ならcssに変換して保存。それ以外ならそのまま保存
            if(attrLang === "sass"){
                let sass = require('sass');
                let tmpSassFilePath = tmpFileName + fileAddition + ".sass";
                fs.writeFileSync(tmpSassFilePath, styleElement.innerHTML);
                fs.writeFileSync(cssTempFile, sass.renderSync({file: tmpSassFilePath}).css.toString());
                fs.unlinkSync(tmpSassFilePath);
            }else if(attrLang === "scss"){
                let sass = require('sass');
                let tmpScssFilePath = tmpFileName + fileAddition + ".scss";
                fs.writeFileSync(tmpScssFilePath, styleElement.innerHTML);
                fs.writeFileSync(cssTempFile, sass.renderSync({file: tmpScssFilePath}).css.toString());
                fs.unlinkSync(tmpScssFilePath);
            }else{
                fs.writeFileSync(cssTempFile, attrLang.innerHTML);
            }

            // 保存したcssファイルを取り込むようにベースファイルのドキュメントに埋め込
            let cssFileOnlyName = cssTempFile.substring(cssTempFile.lastIndexOf('\\') + 1);
            let cssLinkElement = baseDoc.window.document.createElement("link");
            cssLinkElement.setAttribute("rel", "stylesheet");
            cssLinkElement.setAttribute("href", cssFileOnlyName);
            baseDoc.window.document.getElementsByTagName("HEAD")[0].appendChild(cssLinkElement);
        }
        
        // ベースファイルからsvelteのjavascriptを除去する(設定の「disableScript」に設定されている文字列をsrcに含むscriptタグ)
        let disableScript = "" + vscode.workspace.getConfiguration('svelte-instant-view').get('disableScript');
        for(let scriptTag of baseDoc.window.document.getElementsByTagName("script"))
        {
            if(scriptTag.getAttribute("src").toLowerCase().indexOf(disableScript) >= 0){
                scriptTag.remove();
                break;
            }
        }

        // svelteファイルのhtmlをベースファイルのドキュメントに埋め込み
        let insertElement = baseDoc.window.document.getElementById(vscode.workspace.getConfiguration('svelte-instant-view').get('insertTag'));
        if(insertElement === null){
            throw new Error("Can't find TAG(ID:" + vscode.workspace.getConfiguration('svelte-instant-view').get('insertTag') + ") in base html.");
        }
        insertElement.innerHTML = htmElement.outerHTML;

        // svelteの一時ファイルを出力
        fs.writeFileSync(svelteTempFile, baseDoc.serialize());
    }else{
        throw new Error("NO workspase opens !");
    }
}

// 一時ファイルのブラウザ表示
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

// 30秒後に一時ファイルを削除
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