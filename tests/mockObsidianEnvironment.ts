import type { Extension } from "@codemirror/state";
import type { Editor } from "codemirror";
import type {
  App,
  BaseComponent,
  ButtonComponent,
  ColorComponent,
  Command,
  Component,
  DropdownComponent,
  EditorSuggest,
  EventRef,
  ExtraButtonComponent,
  KeymapEventHandler,
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
  MomentFormatComponent,
  Notice as NoticeType,
  ObsidianProtocolHandler,
  Plugin as PluginType,
  PluginManifest,
  PluginSettingTab as PluginSettingTabType,
  SearchComponent,
  Setting as SettingType,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ToggleComponent,
  ViewCreator,
} from "obsidian";

export class Notice implements NoticeType {
  constructor(s: string) {}
  setMessage(message: string | DocumentFragment): this {
    return this;
  }
  hide(): void {}
}
export class Plugin implements PluginType {
  constructor() {}
  app: App;
  manifest: PluginManifest;
  addRibbonIcon(
    icon: string,
    title: string,
    callback: (evt: MouseEvent) => any
  ): HTMLElement {
    throw new Error("Method not implemented.");
  }
  addStatusBarItem(): HTMLElement {
    throw new Error("Method not implemented.");
  }
  addCommand(command: Command): Command {
    throw new Error("Method not implemented.");
  }
  addSettingTab(settingTab: PluginSettingTabType): void {
    throw new Error("Method not implemented.");
  }
  registerView(type: string, viewCreator: ViewCreator): void {
    throw new Error("Method not implemented.");
  }
  registerExtensions(extensions: string[], viewType: string): void {
    throw new Error("Method not implemented.");
  }
  registerMarkdownPostProcessor(
    postProcessor: MarkdownPostProcessor,
    sortOrder?: number | undefined
  ): MarkdownPostProcessor {
    throw new Error("Method not implemented.");
  }
  registerMarkdownCodeBlockProcessor(
    language: string,
    handler: (
      source: string,
      el: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ) => void | Promise<any>,
    sortOrder?: number | undefined
  ): MarkdownPostProcessor {
    throw new Error("Method not implemented.");
  }
  registerCodeMirror(callback: (cm: Editor) => any): void {
    throw new Error("Method not implemented.");
  }
  registerEditorExtension(extension: Extension): void {
    throw new Error("Method not implemented.");
  }
  registerObsidianProtocolHandler(
    action: string,
    handler: ObsidianProtocolHandler
  ): void {
    throw new Error("Method not implemented.");
  }
  registerEditorSuggest(editorSuggest: EditorSuggest<any>): void {
    throw new Error("Method not implemented.");
  }
  loadData(): Promise<any> {
    throw new Error("Method not implemented.");
  }
  saveData(data: any): Promise<void> {
    throw new Error("Method not implemented.");
  }
  load(): void {
    throw new Error("Method not implemented.");
  }
  onload(): void {
    throw new Error("Method not implemented.");
  }
  unload(): void {
    throw new Error("Method not implemented.");
  }
  onunload(): void {
    throw new Error("Method not implemented.");
  }
  addChild<T extends Component>(component: T): T {
    throw new Error("Method not implemented.");
  }
  removeChild<T extends Component>(component: T): T {
    throw new Error("Method not implemented.");
  }
  register(cb: () => any): void {
    throw new Error("Method not implemented.");
  }
  registerEvent(eventRef: EventRef): void {
    throw new Error("Method not implemented.");
  }
  registerDomEvent<K extends keyof WindowEventMap>(
    el: Window,
    type: K,
    callback: (this: HTMLElement, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  registerDomEvent<K extends keyof DocumentEventMap>(
    el: Document,
    type: K,
    callback: (this: HTMLElement, ev: DocumentEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  registerDomEvent<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  registerDomEvent(
    el: unknown,
    type: unknown,
    callback: unknown,
    options?: unknown
  ): void {
    throw new Error("Method not implemented.");
  }
  registerScopeEvent(keyHandler: KeymapEventHandler): void {
    throw new Error("Method not implemented.");
  }
  registerInterval(id: number): number {
    throw new Error("Method not implemented.");
  }
}
export class PluginSettingTab implements PluginSettingTabType {
  app: App;
  containerEl: HTMLElement;
  constructor() {}
  display() {
    throw new Error("Method not implemented.");
  }
  hide() {
    throw new Error("Method not implemented.");
  }
}
export class Setting implements SettingType {
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  components: BaseComponent[];
  constructor() {}
  setName(name: string | DocumentFragment): this {
    throw new Error("Method not implemented.");
  }
  setDesc(desc: string | DocumentFragment): this {
    throw new Error("Method not implemented.");
  }
  setClass(cls: string): this {
    throw new Error("Method not implemented.");
  }
  setTooltip(tooltip: string): this {
    throw new Error("Method not implemented.");
  }
  setHeading(): this {
    throw new Error("Method not implemented.");
  }
  setDisabled(disabled: boolean): this {
    throw new Error("Method not implemented.");
  }
  addButton(cb: (component: ButtonComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addExtraButton(cb: (component: ExtraButtonComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addToggle(cb: (component: ToggleComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addText(cb: (component: TextComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addSearch(cb: (component: SearchComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addTextArea(cb: (component: TextAreaComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addMomentFormat(cb: (component: MomentFormatComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addDropdown(cb: (component: DropdownComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addColorPicker(cb: (component: ColorComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  addSlider(cb: (component: SliderComponent) => any): this {
    throw new Error("Method not implemented.");
  }
  then(cb: (setting: this) => any): this {
    throw new Error("Method not implemented.");
  }
  clear(): this {
    throw new Error("Method not implemented.");
  }
}
