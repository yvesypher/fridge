devtools::install("../ggelato", upgrade = "never")
usethis::use_package("ggelato", type = "Imports")

packer::bundle()
devtools::load_all()
library(fridge)
library(ggelato)

library(tsibble)
library(feasts)
library(fable)
library(tidyverse)

library(plotly)
library(htmltools)
library(htmlwidgets)
library(highcharter)

### Tourism data
agg_tourism <- tourism |>
  aggregate_key((State/Region)*Purpose, Trips = sum(Trips)) |>
  mutate(across(c(State, Region, Purpose), as.character))

agg_tourism_s <- tourism |>
  aggregate_key((State / Region)*Purpose, Trips = sum(Trips)) |>
  group_by_key() |>
  mutate(
    Trips = (Trips - mean(Trips, na.rm = TRUE)) /
      sd(Trips, na.rm = TRUE)
  ) |>
  ungroup() |>
  mutate(across(c(State, Region, Purpose), as.character))

p <- agg_tourism |>
  ggplot(aes(x = Quarter,
             y = Trips,
             group = interaction(State, Region, Purpose),
             text = paste(
               "Quarter:", Quarter,
               "<br>Trips:", Trips,
               "<br>State:", State,
               "<br>Region:", Region,
               "<br>Purpose:", Purpose)
  )
  ) +
  geom_line()

p1 <- ggplotly(p, tooltip = "text")

add_hierarchy_plotly(p1, "(State/Region)*Purpose")

####### STL Decompostion #######

tourism_ft <- tourism |>
  aggregate_key((State / Region)*Purpose, Trips = sum(Trips)) |>
  features(Trips, feature_set(pkgs = "feasts")) |>
  mutate(State = as.character(State), Region = as.character(Region), Purpose = as.character(Purpose)) |>
  as.data.frame()

tourism_agg <- tourism_ft |>
  filter(State == "<aggregated>" | Region == "<aggregated>")

stl_u <- tourism |>
  aggregate_key((State / Region)*Purpose, Trips = sum(Trips)) |>
  model(STL(Trips ~ season(window = "periodic"))) |>
  components() |>
  as.data.frame() |>
  select(State, Region, Purpose, Quarter, Trips, trend, season_year, remainder) |>
  mutate(
    State = as.character(State),
    Region = as.character(Region),
    Purpose = as.character(Purpose),
    Quarter = as.character(Quarter)
  )

stl_s <- tourism |>
  aggregate_key((State / Region)*Purpose, Trips = sum(Trips)) |>
  group_by_key() |>
  mutate(Trips = (Trips - mean(Trips)) / sd(Trips)) |>
  model(STL(Trips ~ season(window = "periodic"))) |>
  components() |>
  as.data.frame() |>
  select(State, Region, Purpose, Quarter, Trips, trend, season_year, remainder) |>
  mutate(
    State = as.character(State),
    Region = as.character(Region),
    Purpose = as.character(Purpose),
    Quarter = as.character(Quarter)
  )

plot1 <- gig_stldp(data = stl_u,scaled = stl_s,
          structure = "(State/Region)*Purpose")

##### sunburst ####
plot2 <- gig_sunburst(
  as_tibble(agg_tourism),                  # any tibble with <aggregated> key cols
  structure = "(State/Region)*Purpose",    # fabletools syntax; NULL = inferred
  labels    = TRUE                         # initial label visibility
)

#### stl

plot3 <- gig_point(tourism_ft,
                   structure = "(State/Region)*Purpose")

#### fridge

fridge(plot1,plot2,plot3)
