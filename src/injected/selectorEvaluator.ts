/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CSSEngine } from './cssSelectorEngine';
import { XPathEngine } from './xpathSelectorEngine';
import { TextEngine } from './textSelectorEngine';
import { SelectorEngine, SelectorRoot } from './selectorEngine';
import Injected from './injected';
import * as types from '../types';
import { createAttributeEngine } from './attributeSelectorEngine';

class SelectorEvaluator {
  readonly engines: Map<string, SelectorEngine>;
  readonly injected: Injected;

  constructor(customEngines: { name: string, engine: SelectorEngine}[]) {
    this.injected = new Injected();
    this.engines = new Map();
    // Note: keep predefined names in sync with Selectors class.
    this.engines.set('css', CSSEngine);
    this.engines.set('xpath', XPathEngine);
    this.engines.set('text', TextEngine);
    this.engines.set('id', createAttributeEngine('id'));
    this.engines.set('data-testid', createAttributeEngine('data-testid'));
    this.engines.set('data-test-id', createAttributeEngine('data-test-id'));
    this.engines.set('data-test', createAttributeEngine('data-test'));
    for (const {name, engine} of customEngines)
      this.engines.set(name, engine);
  }

  querySelector(selector: types.ParsedSelector, root: Node): Element | undefined {
    if (!(root as any)['querySelector'])
      throw new Error('Node is not queryable.');
    return this._querySelectorRecursively(root as SelectorRoot, selector, 0);
  }

  private _querySelectorRecursively(root: SelectorRoot, selector: types.ParsedSelector, index: number): Element | undefined {
    const current = selector[index];
    root = (root as Element).shadowRoot || root;
    if (index === selector.length - 1)
      return this.engines.get(current.name)!.query(root, current.body);
    const all = this.engines.get(current.name)!.queryAll(root, current.body);
    for (const next of all) {
      const result = this._querySelectorRecursively(next, selector, index + 1);
      if (result)
        return result;
    }
  }

  querySelectorAll(selector: types.ParsedSelector, root: Node): Element[] {
    if (!(root as any)['querySelectorAll'])
      throw new Error('Node is not queryable.');
    let set = new Set<SelectorRoot>([ root as SelectorRoot ]);
    for (const { name, body } of selector) {
      const newSet = new Set<Element>();
      for (const prev of set) {
        for (const next of this.engines.get(name)!.queryAll((prev as Element).shadowRoot || prev, body)) {
          if (newSet.has(next))
            continue;
          newSet.add(next);
        }
      }
      set = newSet;
    }
    return Array.from(set) as Element[];
  }
}

export default SelectorEvaluator;
