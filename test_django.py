"""Verify Django static files integration works correctly."""
import pytest


@pytest.fixture(scope='session')
def django_setup():
    import django
    from django.conf import settings
    if not settings.configured:
        settings.configure(
            INSTALLED_APPS=[
                'django.contrib.staticfiles',
                'autocomplete_light',
            ],
            STATIC_URL='/static/',
        )
        django.setup()


@pytest.mark.parametrize('filename', [
    'autocomplete_light/autocomplete-light.js',
    'autocomplete_light/autocomplete-light.css',
])
def test_static_file_discoverable(django_setup, filename):
    from django.contrib.staticfiles.finders import find
    assert find(filename) is not None, f'{filename} not found by Django staticfiles'
