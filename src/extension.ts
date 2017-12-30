'use strict';
import * as vscode from 'vscode';
import parse from './parser';

const MAR_MODE: vscode.DocumentFilter = { language: 'muchassemblyrequired', scheme: 'file' };

export function activate(context: vscode.ExtensionContext) {
    let provider = new MuchAssemblyRequiredProvider();
    provider.activate(context.subscriptions);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

class MuchAssemblyRequiredProvider implements vscode.DefinitionProvider, vscode.HoverProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;

    public activate(subscriptions: vscode.Disposable[]) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection("muchassemblyrequired");

        vscode.workspace.onDidChangeTextDocument(this.OnTextChange, this, subscriptions);
        vscode.workspace.onDidOpenTextDocument(this.DoLint, this, subscriptions);
        vscode.workspace.onDidCloseTextDocument(this.OnDocumentClosed, this, subscriptions);

        subscriptions.push(vscode.languages.registerDefinitionProvider(MAR_MODE, this));
        subscriptions.push(vscode.languages.registerHoverProvider(MAR_MODE, this));
    }

    private OnTextChange(e: vscode.TextDocumentChangeEvent) {
        this.DoLint(e.document);
    }

    private OnDocumentClosed(e: vscode.TextDocument) {
        this.diagnosticCollection.delete(e.uri);
    }

    private DoLint(textDocument: vscode.TextDocument) {
        if (textDocument.languageId !== "muchassemblyrequired") {
            return;
        }
        
        let results = parse(textDocument.getText());

        let diagnostics: vscode.Diagnostic[] = [];
        for (let result of results) {
            let position = new vscode.Position(result.row, result.column);
            let range = new vscode.Range(position, position);

            let diagnostic = new vscode.Diagnostic(range, result.text, vscode.DiagnosticSeverity.Error);
            diagnostics.push(diagnostic);
        }

        this.diagnosticCollection.set(textDocument.uri, diagnostics);
    }

    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition> {
        let range = document.getWordRangeAtPosition(position);
        let word = document.getText(range);

        return this.findLineOfSymbol(document, word);
    }

    public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        let range = document.getWordRangeAtPosition(position);
        let word = document.getText(range);

        let locs = this.findLineOfSymbol(document, word);

        for (let loc of locs) {
            let line = loc.range.start.line;
            let text = document.lineAt(line).text;
            return new vscode.Hover({"language": "muchassemblyrequired", "value": text});
        }

        return null;
    }

    private findLineOfSymbol(document: vscode.TextDocument, symbol: string): vscode.Location[] {
        let re = new RegExp(`^\\s*${symbol}(:|\\s+equ\\b)`, "i");

        let definitions: vscode.Location[] = [];
        let text = document.getText();
        let lines = text.split("\n");
        let count = 0;
        for (let line of lines) {
            var lineText = document.lineAt(count).text;
            if (re.test(lineText)) {
                let def = new vscode.Location(document.uri, new vscode.Position(count, 0));
                definitions.push(def);
            }
            count++;
        }

        return definitions;
    }
}