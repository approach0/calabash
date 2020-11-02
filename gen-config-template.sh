cat config.toml | sed -r 's@SECRET:(.*)@___@g' > config.template.toml
git diff -- config.template.toml
