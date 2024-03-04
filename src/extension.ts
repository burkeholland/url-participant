import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as os from 'os';

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";

const LANGUAGE_MODEL_ID = 'copilot-gpt-3.5-turbo'; // Use faster model. Alternative is 'copilot-gpt-4', which is slower but more powerful

dotenv.config({ path: os.homedir() + '/.env' });

export function activate(context: vscode.ExtensionContext) {

    vscode.chat.registerChatVariableResolver('url', 'The URL to the resource to use as grounding context for this interaction', {
        resolve: async (name, context, token) => {
            try {
                if (name === 'url') {

                    // prompt the user for a url using the vscode.window.showInputBox API
                    const result = await vscode.window.showInputBox({
                        prompt: 'Enter the URL to the resource to use as grounding context for this interaction'
                    }) || "";

                    if (result?.trim() !== '') {

                        // get the content of the url
                        const urlContent = await downloadWebPage(result) || "";

                        // split the text into smaller chunks
                        const documents = await splitTextIntoChunks(urlContent);

                        // create the vector store
                        const vectorStoreRetriever = await createVectorStore(documents);
                        
                        // get the relevant parts of the text content based on the users prompt
                        const docs = await vectorStoreRetriever.getRelevantDocuments(
                            context.prompt
                        );

                        // assemble the relevant parts of the text content into a single string
                        let pageContent = "";
                        docs.forEach((doc) => {
                            pageContent += doc.pageContent;
                        });
                    
                        return [
                            {
                                level: vscode.ChatVariableLevel.Full,
                                value: pageContent
                            }
                        ]
                    }
                }
            }
            catch (err: any) {
                // show a notification with the error
                vscode.window.showErrorMessage(err.message);
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

    async function splitTextIntoChunks(text: string) {
        // use text splitting to create a vector store from the content
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 100,
        });

        const documents = await splitter.createDocuments([text]);

        return documents;
    }

    async function createVectorStore(documents: Document<Record<string, any>>[]) {
        const vectorStore = await HNSWLib.fromDocuments(documents, new OpenAIEmbeddings());
        // Initialize a retriever wrapper around the vector store
        const vectorStoreRetriever = vectorStore.asRetriever();

        return vectorStoreRetriever;
    }
            
}

export function deactivate() { }
