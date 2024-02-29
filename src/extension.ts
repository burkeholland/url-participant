import * as vscode from 'vscode';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const LANGUAGE_MODEL_ID = 'copilot-gpt-3.5-turbo'; // Use faster model. Alternative is 'copilot-gpt-4', which is slower but more powerful

export function activate(context: vscode.ExtensionContext) {

    vscode.chat.registerChatVariableResolver('url', 'The URL to the resource to use as grounding context for this interaction', {
        resolve: async (name, context, token) => {
            if (name == 'url') {

                // prompt the user for a url using the vscode.window.showInputBox API
                const result = await vscode.window.showInputBox({
                    prompt: 'Enter the URL to the resource to use as grounding context for this interaction'
                }) || "";

                if (result?.trim() !== '') {

                    // attempt to get the content of the url
                    const urlContent = await downloadWebPage(result) || "";

                    // chunk the string into 3 parts - 1/3, 2/3, and 3/3
                    const chunkSize = Math.ceil(urlContent.length / 3);
                
                    return [
                        {
                            level: vscode.ChatVariableLevel.Short,
                            value: urlContent.substring(0, chunkSize)
                        },
                        {
                            level: vscode.ChatVariableLevel.Medium,
                            value: urlContent.substring(0, chunkSize * 2)
                        },
                        {
                            level: vscode.ChatVariableLevel.Full,
                            value: urlContent.substring(0, chunkSize * 3)
                        }
                    ]
                }
            }
        }
    });

    async function downloadWebPage(url: string) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const doc = new JSDOM(html, { url });
            const reader = new Readability(doc.window.document);
            const article = reader.parse() || "";

            let content = article ? article.content : "";

            // remove all images
            content = content.replace(/<img[^>]*>/g, "");

            // strip all html chars out of the content
            content = content.replace(/<[^>]*>?/gm, '');

            // remove all line breaks
            content = content.replace(/\r?\n|\r/g, "");
            
            return content;
        }
        catch (err: any) {
            // show a notification with the error
            vscode.window.showErrorMessage(err.message);
        }
    }
            
}

export function deactivate() { }
