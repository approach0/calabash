cat config.toml | sed -r 's@SECRET:(.*)@___@g' > config.template.toml
git diff -- config.template.toml
git add config.template.toml
git commit -m 'update config.template.toml'
