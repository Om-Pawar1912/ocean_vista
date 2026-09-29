def extract_model_profile(
    file_path: Path,
    latitude: float,
    longitude: float,
    observation_time,
    variable: str,
) -> Dict[str, Any]:

    dataset = xr.open_dataset(
        file_path,
        decode_times=True,
    )

    try:

        # =================================================
        # FIND COORDINATE / VARIABLE NAMES
        # =================================================

        lat_name = find_coordinate_name(
            dataset,
            LATITUDE_NAMES,
        )

        lon_name = find_coordinate_name(
            dataset,
            LONGITUDE_NAMES,
        )

        depth_name = find_coordinate_name(
            dataset,
            DEPTH_NAMES,
        )

        time_name = find_coordinate_name(
            dataset,
            TIME_NAMES,
        )

        if lat_name is None:
            raise ValueError(
                "Model dataset does not contain latitude."
            )

        if lon_name is None:
            raise ValueError(
                "Model dataset does not contain longitude."
            )

        if depth_name is None:
            raise ValueError(
                "Model dataset does not contain depth."
            )

        # =================================================
        # RESOLVE REQUESTED VARIABLE
        # =================================================

        actual_variable = resolve_model_variable(
            dataset,
            variable,
        )

        if actual_variable is None:

            available = list(
                dataset.data_vars.keys()
            )

            raise ValueError(
                f"Model variable '{variable}' was not found. "
                f"Available model variables: {available}"
            )

        data = dataset[
            actual_variable
        ]

        # =================================================
        # COORDINATE ARRAYS
        # =================================================

        lat_coord = dataset[
            lat_name
        ]

        lon_coord = dataset[
            lon_name
        ]

        depth_coord = dataset[
            depth_name
        ]

        time_coord = (
            dataset[time_name]
            if time_name is not None
            and time_name in dataset
            else None
        )

        # =================================================
        # BASIC ARRAYS
        # =================================================

        lat_values = np.asarray(
            lat_coord.values,
            dtype=float,
        )

        lon_values = np.asarray(
            lon_coord.values,
            dtype=float,
        )

        # Remove dimensions of size 1 where possible
        # without destroying profile dimensions.

        lat_values = np.squeeze(
            lat_values
        )

        lon_values = np.squeeze(
            lon_values
        )

        # =================================================
        # NORMALIZE MODEL LONGITUDE
        # =================================================

        selected_longitude = (
            normalize_longitude_for_model(
                longitude,
                lon_values,
            )
        )

        # =================================================
        # RESULT VARIABLES
        # =================================================

        model_latitude = None
        model_longitude = None
        selected_model_time = None

        # =================================================
        # DETERMINE DATASET STRUCTURE
        # =================================================
        #
        # IMPORTANT:
        #
        # If:
        #
        # LATITUDE(N_PROF)
        # LONGITUDE(N_PROF)
        #
        # then this is a scattered/profile dataset.
        #
        # We MUST use isel(), not:
        #
        # .sel(N_PROF=..., method="nearest")
        #
        # because N_PROF usually has no xarray index.
        #

        is_scattered_profile_dataset = (
            lat_coord.ndim == 1
            and lon_coord.ndim == 1
            and lat_coord.dims == lon_coord.dims
        )

        # =================================================
        # CASE 1
        # SCATTERED / PROFILE DATASET
        # =================================================

        if is_scattered_profile_dataset:

            profile_dimension = (
                lat_coord.dims[0]
            )

            # -------------------------------------------------
            # Validate coordinate arrays
            # -------------------------------------------------

            if lat_values.size == 0:
                raise ValueError(
                    "Model latitude array is empty."
                )

            if lon_values.size == 0:
                raise ValueError(
                    "Model longitude array is empty."
                )

            if lat_values.size != lon_values.size:

                raise ValueError(
                    "Model latitude and longitude arrays "
                    "have different sizes."
                )

            # -------------------------------------------------
            # Valid profiles
            # -------------------------------------------------

            valid = (
                np.isfinite(
                    lat_values
                )
                &
                np.isfinite(
                    lon_values
                )
            )

            if not np.any(valid):

                raise ValueError(
                    "Model latitude/longitude "
                    "coordinates contain no valid values."
                )

            valid_indices = np.where(
                valid
            )[0]

            # -------------------------------------------------
            # Longitude difference
            # -------------------------------------------------

            longitude_difference = np.abs(
                lon_values[valid]
                -
                selected_longitude
            )

            # Handle longitude wrapping.
            #
            # Example:
            # 359 degrees and -1 degrees
            # are only 2 degrees apart.

            longitude_difference = np.minimum(
                longitude_difference,
                360.0
                -
                longitude_difference,
            )

            # -------------------------------------------------
            # Latitude difference
            # -------------------------------------------------

            latitude_difference = np.abs(
                lat_values[valid]
                -
                float(latitude)
            )

            # -------------------------------------------------
            # Latitude scaling
            # -------------------------------------------------

            latitude_scale = max(
                0.1,
                math.cos(
                    math.radians(
                        float(latitude)
                    )
                ),
            )

            # -------------------------------------------------
            # Approximate horizontal distance
            # -------------------------------------------------

            distance_squared = (
                latitude_difference ** 2
                +
                (
                    longitude_difference
                    *
                    latitude_scale
                ) ** 2
            )

            nearest_position = int(
                np.argmin(
                    distance_squared
                )
            )

            profile_index = int(
                valid_indices[
                    nearest_position
                ]
            )

            # -------------------------------------------------
            # Select profile using POSITIONAL indexing
            # -------------------------------------------------

            if profile_dimension in data.dims:

                data = data.isel(
                    {
                        profile_dimension:
                            profile_index
                    }
                )

            # -------------------------------------------------
            # Actual model location
            # -------------------------------------------------

            model_latitude = safe_float(
                lat_values[
                    profile_index
                ]
            )

            model_longitude = safe_float(
                lon_values[
                    profile_index
                ]
            )

            # =================================================
            # PROFILE TIME
            # =================================================
            #
            # In Argo-style files TIME may be:
            #
            # TIME(N_PROF)
            #
            # Therefore do NOT use:
            #
            # .sel(N_PROF=..., method="nearest")
            #
            # Simply select the same profile position.
            #

            if (
                time_coord is not None
                and
                profile_dimension
                in time_coord.dims
            ):

                try:

                    profile_time = (
                        time_coord.isel(
                            {
                                profile_dimension:
                                    profile_index
                            }
                        ).values
                    )

                    selected_model_time = (
                        profile_time.item()
                        if np.ndim(
                            profile_time
                        ) == 0
                        else profile_time
                    )

                except Exception:

                    selected_model_time = None

        # =================================================
        # CASE 2
        # 2D LAT/LON GRID
        # =================================================

        elif (
            lat_coord.ndim == 2
            and
            lon_coord.ndim == 2
        ):

            lat_array = np.asarray(
                lat_coord.values,
                dtype=float,
            )

            lon_array = np.asarray(
                lon_coord.values,
                dtype=float,
            )

            lat_flat = (
                lat_array.flatten()
            )

            lon_flat = (
                lon_array.flatten()
            )

            valid = (
                np.isfinite(
                    lat_flat
                )
                &
                np.isfinite(
                    lon_flat
                )
            )

            if not np.any(valid):

                raise ValueError(
                    "Model latitude/longitude "
                    "coordinates contain no valid values."
                )

            valid_indices = np.where(
                valid
            )[0]

            longitude_difference = np.abs(
                lon_flat[valid]
                -
                selected_longitude
            )

            longitude_difference = np.minimum(
                longitude_difference,
                360.0
                -
                longitude_difference,
            )

            latitude_difference = np.abs(
                lat_flat[valid]
                -
                float(latitude)
            )

            latitude_scale = max(
                0.1,
                math.cos(
                    math.radians(
                        float(latitude)
                    )
                ),
            )

            distance_squared = (
                latitude_difference ** 2
                +
                (
                    longitude_difference
                    *
                    latitude_scale
                ) ** 2
            )

            nearest_position = int(
                np.argmin(
                    distance_squared
                )
            )

            flat_index = int(
                valid_indices[
                    nearest_position
                ]
            )

            grid_index = np.unravel_index(
                flat_index,
                lat_array.shape,
            )

            # -------------------------------------------------
            # Select grid point
            # -------------------------------------------------

            for index, dimension in enumerate(
                lat_coord.dims
            ):

                if dimension in data.dims:

                    data = data.isel(
                        {
                            dimension:
                                int(
                                    grid_index[index]
                                )
                        }
                    )

            # -------------------------------------------------
            # Actual location
            # -------------------------------------------------

            model_latitude = safe_float(
                lat_array[
                    grid_index
                ]
            )

            model_longitude = safe_float(
                lon_array[
                    grid_index
                ]
            )

            # -------------------------------------------------
            # Time selection for regular grid
            # -------------------------------------------------

            if (
                time_coord is not None
                and
                time_name in data.dims
                and
                observation_time is not None
            ):

                observation_timestamp = (
                    parse_time(
                        observation_time
                    )
                )

                if observation_timestamp is not None:

                    try:

                        # Only use nearest selection when
                        # time is actually an indexed coordinate.

                        if (
                            time_name in
                            data.coords
                            and
                            data[time_name].ndim == 1
                        ):

                            data = data.sel(
                                {
                                    time_name:
                                        observation_timestamp
                                },
                                method="nearest",
                            )

                            if (
                                time_name
                                in data.coords
                            ):

                                selected_model_time = (
                                    data.coords[
                                        time_name
                                    ].item()
                                )

                    except Exception:

                        selected_model_time = None

        # =================================================
        # CASE 3
        # REGULAR 1D LAT/LON GRID
        # =================================================

        elif (
            lat_coord.ndim == 1
            and
            lon_coord.ndim == 1
        ):

            lat_dimension = (
                lat_coord.dims[0]
            )

            lon_dimension = (
                lon_coord.dims[0]
            )

            # -------------------------------------------------
            # Find nearest latitude
            # -------------------------------------------------

            valid_lat = np.isfinite(
                lat_values
            )

            if not np.any(valid_lat):

                raise ValueError(
                    "Model latitude contains no valid values."
                )

            lat_candidates = np.where(
                valid_lat
            )[0]

            latitude_index = int(
                lat_candidates[
                    np.argmin(
                        np.abs(
                            lat_values[
                                valid_lat
                            ]
                            -
                            float(latitude)
                        )
                    )
                ]
            )

            # -------------------------------------------------
            # Find nearest longitude
            # -------------------------------------------------

            valid_lon = np.isfinite(
                lon_values
            )

            if not np.any(valid_lon):

                raise ValueError(
                    "Model longitude contains no valid values."
                )

            lon_candidates = np.where(
                valid_lon
            )[0]

            longitude_index = int(
                lon_candidates[
                    np.argmin(
                        np.abs(
                            lon_values[
                                valid_lon
                            ]
                            -
                            selected_longitude
                        )
                    )
                ]
            )

            # -------------------------------------------------
            # Positional selection
            # -------------------------------------------------

            if lat_dimension in data.dims:

                data = data.isel(
                    {
                        lat_dimension:
                            latitude_index
                    }
                )

            if lon_dimension in data.dims:

                data = data.isel(
                    {
                        lon_dimension:
                            longitude_index
                    }
                )

            model_latitude = safe_float(
                lat_values[
                    latitude_index
                ]
            )

            model_longitude = safe_float(
                lon_values[
                    longitude_index
                ]
            )

            # -------------------------------------------------
            # Time
            # -------------------------------------------------

            if (
                time_coord is not None
                and
                time_name in data.dims
                and
                observation_time is not None
            ):

                observation_timestamp = (
                    parse_time(
                        observation_time
                    )
                )

                if observation_timestamp is not None:

                    try:

                        if (
                            time_name
                            in data.coords
                            and
                            data[
                                time_name
                            ].ndim == 1
                        ):

                            data = data.sel(
                                {
                                    time_name:
                                        observation_timestamp
                                },
                                method="nearest",
                            )

                            if (
                                time_name
                                in data.coords
                            ):

                                selected_model_time = (
                                    data.coords[
                                        time_name
                                    ].item()
                                )

                    except Exception:

                        selected_model_time = None

        else:

            raise ValueError(
                "Unsupported model latitude/longitude "
                "coordinate structure."
            )

        # =================================================
        # DEPTH HANDLING
        # =================================================

        # Refresh depth coordinate because it may contain
        # N_PROF and therefore needs the SAME profile/grid
        # selection as the model variable.

        selected_depth = depth_coord

        # -------------------------------------------------
        # SCATTERED PROFILE DEPTH
        # -------------------------------------------------
        #
        # Example:
        #
        # DEPTH(N_PROF, N_LEVELS)
        #
        # After selecting:
        #
        # DEPTH(profile_index, :)
        #
        # -------------------------------------------------

        if is_scattered_profile_dataset:

            profile_dimension = (
                lat_coord.dims[0]
            )

            if (
                profile_dimension
                in selected_depth.dims
            ):

                # We already selected this profile
                # conceptually above, but depth_coord
                # is still attached to the original
                # dataset, so explicitly select it.

                selected_depth = (
                    selected_depth.isel(
                        {
                            profile_dimension:
                                profile_index
                        }
                    )
                )

        # -------------------------------------------------
        # 2D GRID DEPTH
        # -------------------------------------------------

        elif (
            lat_coord.ndim == 2
            and
            lon_coord.ndim == 2
        ):

            for index, dimension in enumerate(
                lat_coord.dims
            ):

                if dimension in selected_depth.dims:

                    # grid_index was calculated above
                    selected_depth = (
                        selected_depth.isel(
                            {
                                dimension:
                                    int(
                                        grid_index[
                                            index
                                        ]
                                    )
                            }
                        )
                    )

        # -------------------------------------------------
        # REGULAR 1D GRID DEPTH
        # -------------------------------------------------

        elif (
            lat_coord.ndim == 1
            and
            lon_coord.ndim == 1
            and
            lat_coord.dims !=
            lon_coord.dims
        ):

            # Nothing additional required for depth
            # unless depth itself uses spatial dimensions.

            pass

        # =================================================
        # DETERMINE DEPTH DIMENSION
        # =================================================

        depth_dims = list(
            selected_depth.dims
        )

        # Prefer an actual dimension that also exists
        # in the selected model data.

        depth_dim = None

        for dimension in depth_dims:

            if dimension in data.dims:

                depth_dim = dimension
                break

        # Fallback to named depth dimension.

        if (
            depth_dim is None
            and
            depth_name in data.dims
        ):

            depth_dim = depth_name

        # Fallback if only one dimension remains.

        if (
            depth_dim is None
            and
            len(data.dims) == 1
        ):

            depth_dim = list(
                data.dims
            )[0]

        if depth_dim is None:

            raise ValueError(
                "Could not determine model depth dimension."
            )

        # =================================================
        # REDUCE NON-DEPTH DIMENSIONS
        # =================================================

        for dimension in list(
            data.dims
        ):

            if dimension == depth_dim:
                continue

            try:

                # Select first position from any
                # remaining dimension.

                data = data.isel(
                    {
                        dimension:
                            0
                    }
                )

            except Exception:
                pass

        # =================================================
        # EXTRACT DEPTH VALUES
        # =================================================

        depths = np.asarray(
            selected_depth.values
        ).squeeze()

        depths = np.asarray(
            depths,
            dtype=float,
        ).flatten()

        # =================================================
        # EXTRACT MODEL VALUES
        # =================================================

        values = np.asarray(
            data.values
        ).squeeze()

        values = np.asarray(
            values,
            dtype=float,
        ).flatten()

        # =================================================
        # IMPORTANT: DEPTH/VALUE SIZE CHECK
        # =================================================

        if len(depths) == 0:

            raise ValueError(
                "Model depth array is empty after "
                "spatial/profile selection."
            )

        if len(values) == 0:

            raise ValueError(
                f"Model variable '{actual_variable}' "
                "contains no values after "
                "spatial/profile selection."
            )

        # =================================================
        # ALIGN DEPTH AND MODEL VALUES
        # =================================================

        count = min(
            len(depths),
            len(values),
        )

        result_depths = []
        result_values = []

        for index in range(
            count
        ):

            depth = safe_float(
                depths[index]
            )

            value = safe_float(
                values[index]
            )

            if depth is None:
                continue

            if value is None:
                continue

            result_depths.append(
                depth
            )

            result_values.append(
                value
            )

        # =================================================
        # VALIDATION
        # =================================================

        if not result_depths:

            raise ValueError(
                f"Model variable '{actual_variable}' "
                "contains no valid depth/value pairs "
                "after spatial selection."
            )

        # =================================================
        # TIME DIFFERENCE
        # =================================================

        time_difference = (
            time_difference_hours(
                observation_time,
                selected_model_time,
            )
        )

        # =================================================
        # RETURN
        # =================================================

        return {

            "variable":
                normalize_variable_name(
                    variable
                ),

            "actual_variable":
                actual_variable,

            "depth":
                result_depths,

            "values":
                result_values,

            "model_latitude":
                model_latitude,

            "model_longitude":
                model_longitude,

            "model_time":
                (
                    safe_string(
                        selected_model_time
                    )
                    if selected_model_time
                    is not None
                    else None
                ),

            "time_difference_hours":
                time_difference,
        }

    finally:

        dataset.close()