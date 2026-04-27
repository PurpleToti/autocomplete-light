import time

import pytest

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from autocomplete_light import *  # noqa


def test_input_simple(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteLight(browser, 'input-simple')

    # wait until web component has initialized
    inpt = retry(al.input)
    assert inpt

    # box should not have been created yet: it's supposed to be lazy
    assert not al.box()

    # focus on input however, should create the box and display it
    inpt.click()

    # however we want to retry due to the async nature of the browser ofc
    box = retry(al.box)
    assert box
    assert not box.get_property('hidden')

    # all 4 test choices should be visible
    assert retry(lambda: len(al.choices()) == 4)

    # de-focus should hide the box
    al.defocus()
    assert retry(lambda: al.box().get_property('hidden'))

    # let's try filtering out a choice
    al.type('a')

    # should show the box again
    assert retry(lambda: not box.get_property('hidden'))

    # 3 test choices should be visible
    assert retry(lambda: len(al.choices()) == 3)

    choices = al.choices()

    # let's try some keyboard navigation ...
    for i in range(3):
        al.type(Keys.DOWN)
        assert al.hilight() == choices[i]

    # ... all the way back to the top!
    al.type(Keys.DOWN)
    assert al.hilight() == choices[0]

    # and the other way around too ...
    for i in range(3):
        al.type(Keys.UP)
        assert al.hilight() == choices[2 - i]

    # ... back to the bottom!
    al.type(Keys.UP)
    assert al.hilight() == choices[2]

    # try enter to select
    expected = choices[2].text
    al.type(Keys.ENTER)
    assert retry(lambda: al.input().get_attribute('value')) == expected


def test_input_escape(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteLight(browser, 'input-simple')

    retry(al.input)
    al.type('a')
    assert retry(lambda: not al.box().get_property('hidden'))

    al.type(Keys.ESCAPE)
    assert retry(lambda: al.box().get_property('hidden'))


def test_input_tab_commit(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteLight(browser, 'input-simple')

    retry(al.input)
    al.type('a')
    assert retry(lambda: len(al.choices()) == 3)

    al.type(Keys.DOWN)
    expected = al.choices()[0].text
    al.type(Keys.TAB)
    assert retry(lambda: al.input().get_attribute('value')) == expected


def test_input_mouse_hilight(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteLight(browser, 'input-simple')

    retry(al.input)
    al.type('a')
    choices = retry(al.choices)

    # hover second choice — it should get the hilight class
    ActionChains(browser.driver).move_to_element(choices[1]).perform()
    assert retry(lambda: al.hilight() == choices[1])

    # hover first choice — hilight moves, second loses it
    ActionChains(browser.driver).move_to_element(choices[0]).perform()
    assert retry(lambda: al.hilight() == choices[0])


def test_input_no_results(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteLight(browser, 'input-simple')

    retry(al.input)
    al.type('x')  # no choices start with 'x'

    box = retry(al.box)
    assert retry(lambda: not box.get_property('hidden'))
    assert retry(lambda: len(al.choices()) == 0)
    assert retry(lambda: 'No result' in al.box().text)


def test_input_minimum_characters(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteLight(browser, 'input-min-chars')

    inpt = retry(al.input)
    inpt.click()

    # focus alone must not open the box (value length 0 < minimum 2)
    time.sleep(0.5)
    assert not al.box()

    # one character must not open the box
    al.type('a')
    time.sleep(0.5)
    assert not al.box() or al.box().get_property('hidden')

    # two characters must open the box ('aa' matches 'aaa' and 'aab')
    al.type('a')
    box = retry(al.box)
    assert retry(lambda: not box.get_property('hidden'))
    assert retry(lambda: len(al.choices()) == 2)

    # deleting back to one character must hide the box again
    al.type(Keys.BACK_SPACE)
    assert retry(lambda: al.box().get_property('hidden'))


def test_input_resize_hides_box(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteLight(browser, 'input-simple')

    retry(al.input)
    al.type('a')
    assert retry(lambda: not al.box().get_property('hidden'))

    browser.evaluate_script('window.dispatchEvent(new Event("resize"))')
    assert retry(lambda: al.box().get_property('hidden'))


def test_select_simple(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteSelect(browser, 'select-simple')

    al.assert_selected('aab', 1)

    # let's click to remove the selected choice
    al.unselect(0)

    # this should show the autocomplete input again
    assert retry(lambda: not al.alight().get_property('hidden'))

    # this should have removed the choice from the deck
    assert retry(lambda: not al.selected())

    # and emptied the select value
    assert retry(lambda: not al.value())

    # let's type something in the input then
    al.type('a')

    # this should create a suggestion box
    box = retry(al.box)
    assert box

    # which should be displayed
    assert retry(lambda: not box.get_property('hidden'))

    # let's click a choice
    al.choices()[2].click()

    # should it all be like in the beginning but with this other value
    al.assert_selected('abb', 2)


def test_select_change_event(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteSelect(browser, 'select-simple')

    count = lambda: browser.evaluate_script('window.changeCount["select-simple"] || 0')

    initial = count()
    al.unselect(0)
    assert retry(lambda: count() > initial)

    after_unselect = count()
    al.type('a')
    retry(al.choices)
    al.choices()[0].click()
    assert retry(lambda: count() > after_unselect)


def test_select_max_choices_eviction(browser):
    browser.visit('http://localhost:8000')
    al = AutocompleteSelect(browser, 'select-simple')

    al.assert_selected('aab', 1)

    # programmatically select a second choice while at capacity (maxChoices=1);
    # the component should evict the current selection automatically
    browser.evaluate_script('''
        var div = document.createElement("div")
        div.setAttribute("data-value", "2")
        div.textContent = "abb"
        document.getElementById("select-simple").choiceSelect(div)
    ''')

    al.assert_selected('abb', 2)


@pytest.mark.parametrize('name', [
    'select-multiple',
    'select-multiple-local',
])
def test_select_multiple(browser, name):
    browser.visit('http://localhost:8000')
    al = AutocompleteSelectMultiple(browser, name)

    al.assert_selected(('aaa', 0), ('bbb', 3))

    # ensure selected choices are hidden
    al.focus()
    assert not any([
        choice.text in ('aaa', 'bbb')
        for choice in al.choices()
    ])

    # deselect the first option
    al.unselect(0)
    al.assert_selected(('bbb', 3))

    # type something to select the second option
    al.type('a')

    # this should create a suggestion box
    box = retry(al.box)
    assert box

    # which should be displayed
    assert retry(lambda: not box.get_property('hidden'))

    # let's click a choice
    al.choices()[2].click()

    # should it all be like in the beginning but with this other value
    al.assert_selected(('bbb', 3), ('abb', 2))

    # ensure selected choices are hidden
    al.focus()
    assert not any([
        choice.text in ('bbb', 'abb')
        for choice in al.choices()
    ])


@pytest.mark.parametrize('name', [
    'select-multiple',
    'select-multiple-local',
])
def test_select_multiple_change_event(browser, name):
    browser.visit('http://localhost:8000')
    al = AutocompleteSelectMultiple(browser, name)

    count = lambda: browser.evaluate_script(f'window.changeCount["{name}"] || 0')

    initial = count()
    al.unselect(0)
    assert retry(lambda: count() > initial)

    after_unselect = count()
    al.type('a')
    retry(al.choices)
    al.choices()[0].click()
    assert retry(lambda: count() > after_unselect)
