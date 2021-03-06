#!/bin/bash

echo This is a guide only, please either edit or run appropriate commands manually
exit

# for Ubuntu 14.04
# sudo apt-get update
# sudo apt-get install python-pip git libxml2-dev libxslt1-dev python-dev zlib1g-dev python-wand
# sudo apt-get install python-virtualenv virtualenvwrapper python-psycopg2 python-yaml ipython
# sudo apt-get install python-anyjson python-bs4 python-billiard python-feedparser python-html5lib
# sudo apt-get install python-httplib2 python-pystache python-crypto python-flexmock python-dateutil
# sudo apt-get install libldap2-dev libsasl2-dev libssl-dev
# # optionally:
# # sudo apt-get install memcached python-memcache


# for OS X we need these dependencies installed via brew
# brew install imagemagick --with-libtiff
# brew install libmagic freetype
# brew install postgresql
# or for a local development server, install http://postgresapp.com/

# for Ubuntu 14.04
# source /usr/share/virtualenvwrapper/virtualenvwrapper.sh
# for OS X
# source /usr/local/bin/virtualenvwrapper.sh

mkvirtualenv --system-site-packages mytardis

pip install -U pip
pip install -r requirements.txt
# for OS X, but might also need some brew requirements.
pip install -r requirements-osx.txt

mkdir -p var/store

# execute this wonderful command to have your settings.py created/updated
# with a generated Django SECRET_KEY (required for MyTardis to run)
python -c "import os; from random import choice; key_line = '%sSECRET_KEY=\"%s\"  # generated from build.sh\n' % ('from tardis.settings_changeme import * \n\n' if not os.path.isfile('tardis/settings.py') else '', ''.join([choice('abcdefghijklmnopqrstuvwxyz0123456789\\!@#$%^&*(-_=+)') for i in range(50)])); f=open('tardis/settings.py', 'a+'); f.write(key_line); f.close()"

python test.py
# for empty databases, sync all and fake migrate, otherwise run a real migration
python mytardis.py migrate
python mytardis.py createcachetable default_cache
python mytardis.py createcachetable celery_lock_cache
python mytardis.py collectstatic

python mytardis.py runserver
# os x:
open http://127.0.0.1:8000/

# build docs into docs (sphinx-build inputfolder outputfolder)
sphinx-build docs docs
