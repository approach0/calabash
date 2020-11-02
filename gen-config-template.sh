cat config.toml | sed -r 's@SECRET:(.*)@___@g' > config.template.toml
