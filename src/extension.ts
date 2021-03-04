// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import showSvelteView from './svelteInstantViwer';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// svelte インスタントビューのコマンドを登録
	let disposable = vscode.commands.registerCommand('svelte-instant-view.show', (target) => {
		// The code you place here will be executed every time your command is executed

		// svelteのインスタントビューをブラウザで表示する
		try{
			showSvelteView(context, target);
		}
		catch(err){
			vscode.window.showErrorMessage(err.message);
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

