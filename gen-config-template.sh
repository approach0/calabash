cat config.toml | sed -r -e 's@SECRET:(.*)@SECRET:___@g' -e 's@NOPUSH:(.*)@NOPUSH:___@g' > config.template.toml
git diff -- config.template.toml
