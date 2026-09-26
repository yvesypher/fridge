#' Compose several ggelato plots into a coordinated dashboard
#'
#' Arranges one or more `ggelato` plots into a floating-window platform
#' with a shared selection, a shared hierarchy widget and a shared toolbar.
#'
#' @section Accepting gig specifications:
#' A plot can be either a built htmlwidget (via `ggelato::gig_build()`) or
#' an unbuilt `gig` specification (from `gig(...) + geom_*(...)`).
#' `fridge()` accepts both and builds any specification for you, so these
#' are equivalent:
#'
#' ```
#' spec <- gig(tourism_tbl) + geom_sunburst() + hierarchy((State/Region)*Purpose)
#' fridge(gig_build(spec))
#'
#' fridge(spec)
#' ```
#'
#' This is also the supported way to show several views at once: a single
#' `gig()` plot takes one geom layer, and `fridge()` is the composition
#' layer that coordinates several of them.
#'
#' @param ... One or more plots created by `ggelato`: either built
#'   htmlwidgets or unbuilt `gig` specifications. Names become window
#'   titles.
#' @param structure Optional structure specification, either a string or
#'   a `ggelato::hierarchy()` object. When `NULL`, the structure is taken
#'   from the supplied plots.
#' @param hierarchy Deprecated alias for `structure`.
#' @param width,height Widget width and height.
#' @param fullscreen Whether the widget should take over the complete browser
#'   viewport. Use `FALSE` when embedding `fridge` in Quarto, Closeread,
#'   R Markdown, or another scrolling document.
#' @param elementId Optional widget element ID.
#'
#' @export
fridge <- function(..., structure = NULL, hierarchy = NULL,
                   width = NULL, height = NULL,
                   fullscreen = TRUE,
                   elementId = NULL) {

  plots <- list(...)

  if (length(fullscreen) != 1L || is.na(fullscreen) || !is.logical(fullscreen)) {
    stop("`fullscreen` must be a single TRUE or FALSE value.", call. = FALSE)
  }

  if (!is.null(structure) && !is.null(hierarchy)) {
    stop(
      "Supply only `structure` or its deprecated `hierarchy` alias, not both.",
      call. = FALSE
    )
  }
  structure <- structure %||% hierarchy

  # `structure` may arrive as a ggelato::hierarchy() object rather than a
  # bare string. Normalise to the string the browser payload expects.
  structure <- fridge_structure_string(structure)

  if (length(plots) == 0L) {
    stop("Please input at least one ggelato plot.", call. = FALSE)
  }

  # Build any unbuilt gig specifications before inspecting the widgets. This
  # keeps every downstream step - class checks, payload extraction, the
  # dependency walk - working on real htmlwidgets exactly as before.
  plots <- lapply(seq_along(plots), function(i) {
    fridge_build_plot(plots[[i]], i)
  })

  supported <- c("gig_stldp", "gig_point", "gig_sunburst")

  payload <- lapply(seq_along(plots), function(i) {
    w <- plots[[i]]

    if (!inherits(w, "htmlwidget")) {
      stop("Argument ", i, " is not an htmlwidget created by ggelato.",
           call. = FALSE)
    }

    type <- intersect(supported, class(w))[1]

    if (is.na(type)) {
      stop(
        "Unsupported widget class for argument ", i, ": ",
        paste(class(w), collapse = ", "),
        ". fridge() supports: ", paste(supported, collapse = ", "), ".",
        call. = FALSE
      )
    }

    supplied_name <- names(plots)[i]
    if (is.null(supplied_name) || is.na(supplied_name) || !nzchar(supplied_name)) {
      supplied_name <- NULL
    }

    list(type = type, title = supplied_name, x = w$x)
  })

  plot_structures <- unique(Filter(
    function(value) !is.null(value) && nzchar(value),
    lapply(payload, function(p) p$x$structure %||% p$x$hierarchy)
  ))

  if (is.null(structure) && length(plot_structures)) {
    if (length(plot_structures) > 1L) {
      stop(
        "The supplied plots use different structure specifications. ",
        "Pass structure = explicitly to fridge().",
        call. = FALSE
      )
    }
    structure <- plot_structures[[1]]
  }

  if (is.null(structure) || !nzchar(structure)) {
    stop(
      "No structure specification was found. Pass structure = to fridge().",
      call. = FALSE
    )
  }

  if (length(plot_structures) &&
      any(vapply(plot_structures, function(value) !identical(value, structure), logical(1)))) {
    warning(
      "fridge() is using structure = '", structure,
      "' for all plots, overriding a structure stored in at least one plot.",
      call. = FALSE
    )
  }

  # An outer htmlwidget does not automatically inherit dependencies declared
  # in an inner widget's YAML. Carry over the supporting libraries (Chart.js,
  # D3, CSS, etc.) while excluding the inner widget bindings themselves.
  dependencies <- unlist(Map(function(w, p) {
    widget_package <- attr(w, "package") %||% "ggelato"
    yaml_dependencies <- htmlwidgets::getDependency(
      name = p$type,
      package = widget_package
    )
    excluded <- c("htmlwidgets", paste0(p$type, "-binding"))
    yaml_dependencies <- Filter(
      function(dependency) !is.null(dependency) &&
        !dependency$name %in% excluded,
      yaml_dependencies
    )
    dependencies <- c(yaml_dependencies, w$dependencies %||% list())
    lapply(dependencies, stamp_dependency_assets, package = widget_package)
  }, plots, payload), recursive = FALSE)

  # The reusable hierarchy implementation is owned by ggelato. fridge loads
  # the installed browser API instead of compiling another copy into
  # fridge.js. The dependency version includes the installed file timestamp,
  # so reinstalling ggelato invalidates the browser cache even during local
  # development without a package-version bump.
  dependencies <- c(
    list(
      ggelato_browser_api_dependency(),
      fridge_styles_dependency()
    ),
    dependencies
  )
  dependencies <- htmltools::resolveDependencies(dependencies)

  x <- list(
    plots = payload,
    structure = structure,
    fullscreen = fullscreen,
    # Retain the old payload name for one transition release.
    hierarchy = structure
  )

  # create widget
  htmlwidgets::createWidget(
    name = "fridge",
    x = x,
    width = width,
    height = height,
    package = "fridge",
    dependencies = dependencies,
    elementId = elementId,
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth = "100%",
      defaultHeight = 700,
      viewer.fill = TRUE,
      browser.fill = TRUE,
      knitr.figure = FALSE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = 700
    )
  )
}

# Null-coalescing helper kept internal to avoid importing another package.
`%||%` <- function(x, y) if (is.null(x)) y else x

# Accept either a built ggelato htmlwidget or an unbuilt gig specification.
# Specifications are built with ggelato::gig_build(); anything else is passed
# through untouched so the existing class check reports the same error.
fridge_build_plot <- function(plot, index) {
  if (!inherits(plot, "gig")) return(plot)

  if (!requireNamespace("ggelato", quietly = TRUE)) {
    stop(
      "Argument ", index, " is a <gig> plot specification, but the ggelato ",
      "package is not available to build it.",
      call. = FALSE
    )
  }
  if (!exists("gig_build", envir = asNamespace("ggelato"), inherits = FALSE)) {
    stop(
      "Argument ", index, " is a <gig> plot specification, but the installed ",
      "ggelato package does not provide gig_build(). Install the version of ",
      "ggelato that introduced the gig() grammar, restart R, and rebuild ",
      "the plots.",
      call. = FALSE
    )
  }

  ggelato::gig_build(plot)
}

# Accept a ggelato::hierarchy() object or a plain string for `structure`.
fridge_structure_string <- function(structure) {
  if (is.null(structure)) return(NULL)

  if (inherits(structure, "gig_hierarchy")) {
    # The object stores the normalised string in $structure. Read it
    # directly rather than depending on a ggelato accessor, so fridge keeps
    # working against an older installed ggelato.
    value <- structure$structure
    if (!is.character(value) || length(value) != 1L) {
      stop("The supplied hierarchy object is malformed.", call. = FALSE)
    }
    return(value)
  }

  if (is.character(structure) && length(structure) == 1L) return(structure)

  stop(
    "`structure` must be a single string or a ggelato::hierarchy() object.",
    call. = FALSE
  )
}

# Append the newest dependency-asset timestamp to its declared version. This
# makes local package reinstalls visible to RStudio Viewer and Quarto even when
# the development package version has not changed.
stamp_dependency_assets <- function(dependency, package) {
  if (is.null(dependency) || is.null(dependency$src$file)) return(dependency)

  source_root <- dependency$src$file
  if (!dir.exists(source_root)) {
    source_root <- system.file(source_root, package = package)
  }
  if (!nzchar(source_root) || !dir.exists(source_root)) return(dependency)

  assets <- unlist(c(dependency$script, dependency$stylesheet), use.names = FALSE)
  assets <- assets[nzchar(assets)]
  paths <- file.path(source_root, assets)
  paths <- paths[file.exists(paths)]
  if (!length(paths)) return(dependency)

  modified <- max(as.numeric(file.info(paths)$mtime), na.rm = TRUE)
  if (is.finite(modified)) {
    dependency$version <- paste0(
      as.character(dependency$version %||% "0.0.0"),
      ".",
      format(floor(modified), scientific = FALSE, trim = TRUE)
    )
  }
  dependency
}

ggelato_browser_api_dependency <- function() {
  source_root <- system.file(
    "htmlwidgets/lib/ggelato-api",
    package = "ggelato"
  )
  api_file <- file.path(source_root, "ggelato-api.js")
  if (!nzchar(source_root) || !file.exists(api_file)) {
    stop(
      "The installed ggelato package does not contain its shared browser API. ",
      "Install the corrected ggelato package, restart R, and recreate the plots.",
      call. = FALSE
    )
  }

  dependency <- htmltools::htmlDependency(
    name = "ggelato-api",
    version = as.character(utils::packageVersion("ggelato")),
    src = c(file = source_root),
    script = "ggelato-api.js"
  )
  stamp_dependency_assets(dependency, package = "ggelato")
}

fridge_styles_dependency <- function() {
  source_root <- system.file("htmlwidgets", package = "fridge")
  stylesheet <- file.path(source_root, "assets/css/styles.css")
  if (!nzchar(source_root) || !file.exists(stylesheet)) {
    stop("The fridge stylesheet could not be found.", call. = FALSE)
  }

  dependency <- htmltools::htmlDependency(
    name = "fridge-styles",
    version = as.character(utils::packageVersion("fridge")),
    src = c(file = source_root),
    stylesheet = "assets/css/styles.css"
  )
  stamp_dependency_assets(dependency, package = "fridge")
}

#' Shiny bindings for fridge
#'
#' Output and render functions for using fridge within Shiny
#' applications and interactive Rmd documents.
#'
#' @param outputId output variable to read from
#' @param width,height Must be a valid CSS unit (like \code{'100\%'},
#'   \code{'400px'}, \code{'auto'}) or a number, which will be coerced to a
#'   string and have \code{'px'} appended.
#' @param expr An expression that generates a fridge
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{quote()})? This
#'   is useful if you want to save an expression in a variable.
#'
#' @name fridge-shiny
#'
#' @export
fridgeOutput <- function(outputId, width = '100%', height = '400px'){
  htmlwidgets::shinyWidgetOutput(outputId, 'fridge', width, height, package = 'fridge')
}

#' @rdname fridge-shiny
#' @export
renderFridge <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  htmlwidgets::shinyRenderWidget(expr, fridgeOutput, env, quoted = TRUE)
}
