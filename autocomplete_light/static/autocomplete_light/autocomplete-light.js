class AutocompleteLight extends HTMLElement {
  box = null
  xhr = null
  timeoutId = null

  connectedCallback(retries = 20) {
    this.input = this.querySelector('[slot=input]')
    if (!this.input) {
      if (retries > 0) setTimeout(() => this.connectedCallback(retries - 1), 100)
      return
    }

    this.input.addEventListener(
      'focus',
      () => this.input.value.length >= this.minimumCharacters && this.onInput()
    )
    this.input.addEventListener('keydown', this.keyboard.bind(this))
    this.input.addEventListener('input', this.onInput.bind(this))
    window.addEventListener(
      'resize',
      () => this.box && this.box.setAttribute('hidden', 'true')
    )
    this.setAttribute('data-bound', 'true')
  }

  get hidden() {
    return this.input.getAttribute('hidden')
  }

  set hidden(value) {
    if (value) {
      this.input.setAttribute('hidden', 'true')
    } else {
      this.input.removeAttribute('hidden')
    }
  }

  onInput() {
    // clear any unsent xhr
    this.xhr && this.xhr.readyState === 0 && this.xhr.abort()
    // clear any planned xhr
    this.timeoutId && window.clearTimeout(this.timeoutId)
    // debounce: 200ms
    this.timeoutId = window.setTimeout(this.download.bind(this), 200)
  }

  hilight(choice) {
    this.selected.forEach((item) => item.classList.remove('hilight'))
    choice.classList.add('hilight')
  }

  selectChoice(choice) {
    this.dispatchEvent(new CustomEvent('autocompleteChoiceSelected', {
      detail: {choice},
      bubbles: true,
    }))
    this.box.setAttribute('hidden', 'true')
  }

  get url() {
    return this.getAttribute('url') + '?q=' + this.input.value
  }

  download() {
    this.xhr = new XMLHttpRequest()
    this.xhr.addEventListener('load', this.receive.bind(this))
    this.xhr.open('GET', this.url)
    this.xhr.send()
  }

  keyboard(ev) {
    switch(ev.key) {
      // Prevent cursor movement in input on arrow keys.
      case 'ArrowDown':
      case 'ArrowUp':
        ev.preventDefault()
        ev.stopPropagation()
        this.move(ev.key === 'ArrowUp' ? 'up' : 'down')
        break

      case 'Tab':
      case 'Enter':
        if (this.box.getAttribute('hidden')) return

        var choice = this.box.querySelector('.hilight')

        if (!choice) {
          // Don't get in the way, let the browser submit form or focus
          // on next element.
          return
        }

        ev.preventDefault()
        ev.stopPropagation()

        this.selectChoice(choice)
        break

      case 'Escape':
        this.box.setAttribute('hidden', 'true')
        break
    }
  }

  move(way) {
    if (this.input.value.length < this.minimumCharacters) return true

    var current = this.box.querySelector('.hilight')

    // First and last choices for wrap-around navigation.
    var first = this.choices[0]
    var last = this.choices[this.choices.length - 1]

    var target

    this.draw()

    if (current) {
      if (way === 'up') {
        var next = this.choices.indexOf(current) - 1
        target = next < 0 ? last : this.choices[next]
      } else {
        var next = this.choices.indexOf(current) + 1
        target = next >= this.choices.length ? first : this.choices[next]
      }
    } else {
      target = way === 'up' ? last : first
    }

    target !== undefined && this.hilight(target)
  }

  get choices() {
    return Array.from(this.box.querySelectorAll(this.choiceSelector))
  }

  get selected() {
    return this.box.querySelectorAll(this.choiceSelector + '.hilight')
  }

  get choiceSelector() {
    return this.getAttribute('choice-selector') || '[data-value]'
  }

  get minimumCharacters() {
    return this.getAttribute('minimum-characters') || 0
  }

  receive(ev) {
    this.draw()
    this.box.innerHTML = ev.target.response
    this.box.querySelectorAll(this.choiceSelector).forEach((item) => {
      if (item.getAttribute('data-bound'))
        return

      item.addEventListener('mouseenter', (ev) => this.hilight(ev.target))
      item.addEventListener('mouseleave', (ev) => ev.target.classList.remove('hilight'))
      // mousedown fires before blur/focusout, so the box stays visible long
      // enough to register the click before hiding.
      item.addEventListener('mousedown', (ev) => this.selectChoice(ev.target))

      item.setAttribute('data-bound', 'true')
    })
  }

  boxBuild() {
    this.box = document.createElement('div')
    this.box.classList.add('autocomplete-light-box')
    document.querySelector('body').appendChild(this.box)

    this.input.addEventListener('focusout', () => this.box.setAttribute('hidden', 'true'))
    this.input.addEventListener('blur', () => this.box.setAttribute('hidden', 'true'))
  }

  draw() {
    if (!this.box) this.boxBuild()
    var rect = this.input.getBoundingClientRect()
    this.box.style.top = rect.bottom + window.scrollY + 'px'
    this.box.style.left = rect.left + 'px'
    // keep some space for the border, avoid overflow on x
    this.box.style.width = rect.width - 2 + 'px'
    this.box.removeAttribute('hidden')
  }
}


class AutocompleteSelectInput extends AutocompleteLight {
  get url() {
    if (!this.getAttribute('url')) return
    var url = this.getAttribute('url') + '?q=' + this.input.value
    this.parentNode.querySelectorAll('option[selected]').forEach((option) => {
      url += '&_=' + option.value
    })
    return url
  }

  download() {
    if (this.url) {
      return super.download()
    }

    // No URL: filter local <option> tags instead of fetching from server.
    this.receive({
      target: {
        response: Array.from(
          this.closest('autocomplete-select').select.options
        ).filter(
          (item) => !item.selected && item.innerText.startsWith(this.input.value)
        ).map(
          (item) => `<div data-value="${item.getAttribute('value')}">${item.innerHTML}</div>`
        ).join('\n'),
      }
    })
  }
}


class AutocompleteSelect extends HTMLElement {
  maxChoices = 0

  connectedCallback(retries = 20) {
    if (!this.select || !this.input.input) {
      if (retries > 0) setTimeout(() => this.connectedCallback(retries - 1), 100)
      return
    }

    if (!this.select.multiple) {
      this.maxChoices = 1
    }

    this.input.addEventListener(
      'autocompleteChoiceSelected',
      (ev) => this.choiceSelect(ev.detail.choice)
    )
    this.input.hidden = this.maxChoices && this.selected.length >= this.maxChoices

    // ensure all selected options are in deck
    Array.from(
      this.select.querySelectorAll('option[selected]')
    ).map((option) => {
      var exists = this.deck.querySelectorAll(
        '[data-value="' + option.getAttribute('value') + '"]'
      )
      if (exists.length) return
      var cmp = document.createElement('div')
      cmp.setAttribute('selected', 'selected')
      cmp.setAttribute('data-value', option.getAttribute('value'))
      cmp.innerHTML = option['innerHTML']
      this.choiceSelect(cmp, false)
    })

    // ensure all deck values are in select
    Array.from(
      this.deck.querySelectorAll('[data-value]')
    ).map((choice) => {
      if (!this.select.querySelector('option[value="' + choice.getAttribute('data-value') + '"]')) {
        this.choiceSelect(choice, false)
      }
      this.addClear(choice)
    })

    this.setAttribute('data-bound', 'true')
  }

  get deck() {
    return this.querySelector('[slot=deck]')
  }

  get select() {
    return this.querySelector('[slot=select]')
  }

  get selected() {
    return this.deck.querySelectorAll('[data-value]')
  }

  get input() {
    return this.querySelector('autocomplete-select-input, autocomplete-light')
  }

  onClearClick(ev) {
    this.choiceUnselect(ev.target.parentNode)
    ev.preventDefault()
    ev.stopPropagation()
  }

  choiceUnselect(choice, noShowHide = false) {
    var value = choice.getAttribute('data-value')

    var option = this.select.querySelector('option[value="' + value + '"]')
    if (option) {
      option.removeAttribute('selected')
    }

    var decked = this.deck.querySelector('[data-value="' + value + '"]')
    if (decked) {
      decked.parentNode.removeChild(decked)
    }

    if (!this.selected.length) {
      this.select.value = ''
    }

    if (!noShowHide)
      this.input.hidden = this.maxChoices && this.selected.length >= this.maxChoices

    this.changeTrigger()
  }

  choiceSelect(choice, trigger = true) {
    if (this.maxChoices && this.selected.length >= this.maxChoices) {
      this.choiceUnselect(this.selected[0], true)
    }

    var value = choice.getAttribute('data-value')

    if (!this.select.multiple) {
      this.select.value = value
    }

    var option = this.select.querySelector('option[value="' + value + '"]')
    if (!option) {
      option = document.createElement('option')
      option.setAttribute('value', value)
      option.innerHTML = choice.innerHTML
      this.select.appendChild(option)
    }
    option.setAttribute('selected', 'selected')

    if (!this.deck.querySelector('[data-value="' + value + '"]')) {
      choice = choice.cloneNode(true)
      choice.classList.remove('hilight')
      this.addClear(choice)
      this.deck.appendChild(choice)
    }

    this.input.hidden = this.maxChoices && this.selected.length >= this.maxChoices

    trigger && this.changeTrigger()
  }

  changeTrigger() {
    this.select.dispatchEvent(
      new Event('change', {bubbles: true, cancelable: false})
    )
  }

  addClear(choice) {
    if (choice.querySelector('.clear'))
      return
    var clear = document.createElement('span')
    clear.classList.add('clear')
    clear.addEventListener('click', this.onClearClick.bind(this))
    clear.innerHTML = '&#10060;'
    choice.appendChild(clear)
  }
}

window.customElements.define('autocomplete-light', AutocompleteLight)
window.customElements.define('autocomplete-select-input', AutocompleteSelectInput)
window.customElements.define('autocomplete-select', AutocompleteSelect)
